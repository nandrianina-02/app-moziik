package com.moziik.app.donnees.horsligne

import com.moziik.app.donnees.catalogue.ArtisteCourt
import com.moziik.app.donnees.catalogue.Titre
import com.moziik.app.donnees.reseau.JsonMoziik
import com.moziik.app.donnees.reseau.adresseMedia
import com.moziik.app.donnees.reseau.messageDuCorps
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import com.moziik.app.donnees.catalogue.ReponseParoles

/** Un titre gardé sur le téléphone (spécification 6.2) : de quoi l'afficher et le jouer sans réseau. */
@Serializable
data class TitreTelecharge(
    val id: String,
    val titre: String,
    val artiste: String? = null,
    val artisteId: String? = null,
    val verifie: Boolean = false,
    val duree: Double = 0.0,
    val qualite: String = "high",
    val octets: Long = 0,
    /** manual, album ou playlist. */
    val source: String = "manual",
    val telechargeLe: Long = System.currentTimeMillis(),
    val ecouteLe: Long? = null,
)

/** Le site refuse de servir le titre : non publié (403) ou disparu (404). Rien à réessayer. */
class TitreIndisponible(message: String) : IOException(message)

/**
 * Les téléchargements : le fichier audio et sa pochette dans le stockage
 * privé de l'app, et un index des titres. Le fichier est celui que sert
 * /api/stream à la qualité choisie (le lien signé de l'hébergeur ne vit
 * que six heures : il est suivi aussitôt).
 */
class Telechargements(
    racine: File,
    /** Le client du site : jeton posé, retiré par OkHttp sur la redirection vers l'hébergeur. */
    private val client: OkHttpClient,
    private val site: String,
    /** Le compte connecté au lancement ; ensuite, changerDeCompte. */
    compteInitial: String? = null,
) {
    private val dossier = File(racine, "telechargements").apply { mkdirs() }

    /**
     * Un index par compte (index-<id>.json), les fichiers en commun : un
     * titre gardé par deux comptes n'occupe la place qu'une fois. Se
     * déconnecter ne supprime rien ; chaque compte ne voit que les siens,
     * et les retrouve en se reconnectant.
     */
    private var compte: String? = cle(compteInitial)?.also(::adopterAncienIndex)

    private val _titres = MutableStateFlow(lireIndex(compte))
    /** Du plus récent au plus ancien. */
    val titres: StateFlow<List<TitreTelecharge>> = _titres.asStateFlow()

    private val _enCours = MutableStateFlow<Map<String, Float>>(emptyMap())
    /** Les téléchargements en cours et leur avancement (0 à 1). */
    val enCours: StateFlow<Map<String, Float>> = _enCours.asStateFlow()

    private fun cle(id: String?) = id?.filter { it.isLetterOrDigit() }?.ifEmpty { null }

    private fun index(c: String) = File(dossier, "index-$c.json")

    /** L'index unique d'avant la séparation par compte revient au premier compte connecté : c'est lui qui l'a rempli. */
    private fun adopterAncienIndex(c: String) {
        val ancien = File(dossier, "index.json")
        if (ancien.exists() && !index(c).exists()) ancien.renameTo(index(c))
    }

    /** Connexion, déconnexion ou changement de compte : la liste devient celle du compte (vide pour un visiteur). */
    @Synchronized
    fun changerDeCompte(id: String?) {
        val c = cle(id)
        if (c == compte) return
        c?.let(::adopterAncienIndex)
        compte = c
        _titres.value = lireIndex(c)
    }

    private fun lireFichier(f: File): List<TitreTelecharge> = runCatching {
        JsonMoziik.decodeFromString(ListSerializer(TitreTelecharge.serializer()), f.readText())
    }.getOrDefault(emptyList())

    private fun lireIndex(c: String?): List<TitreTelecharge> =
        if (c == null) emptyList() else lireFichier(index(c)).filter { audio(it.id).exists() }

    @Synchronized
    private fun ecrireIndex(transformation: (List<TitreTelecharge>) -> List<TitreTelecharge>) {
        val c = compte ?: return
        val nouveaux = transformation(_titres.value)
        _titres.value = nouveaux
        runCatching { index(c).writeText(JsonMoziik.encodeToString(ListSerializer(TitreTelecharge.serializer()), nouveaux)) }
    }

    /** Un autre compte, ou l'ancien index pas encore adopté, garde-t-il ce titre ? Son fichier reste alors. */
    private fun gardeAilleurs(id: String): Boolean =
        dossier.listFiles { f -> f.name.endsWith(".json") && (f.name == "index.json" || f.name.startsWith("index-")) && f.name != "index-$compte.json" }
            ?.any { f -> lireFichier(f).any { it.id == id } } == true

    private fun audio(id: String) = File(dossier, "$id.mp3")
    private fun pochette(id: String) = File(dossier, "$id.jpg")
    private fun paroles(id: String) = File(dossier, "$id.lrc")

    /** Les paroles gardées avec un titre téléchargé, pour les lire sans réseau ; null s'il n'en a pas. */
    fun parolesGardees(id: String): String? = paroles(id).takeIf { it.exists() && estTelecharge(id) }?.readText()

    /** Les paroles lues en ligne d'un titre téléchargé : la copie du téléphone suit la version publiée. */
    fun garderParoles(id: String, brut: String) {
        if (!estTelecharge(id)) return
        val f = paroles(id)
        if (brut.isBlank()) f.delete() else if (!f.exists() || f.readText() != brut) f.writeText(brut)
    }

    private fun effacer(id: String) {
        if (gardeAilleurs(id)) return
        audio(id).delete()
        pochette(id).delete()
        paroles(id).delete()
    }

    fun estTelecharge(id: String): Boolean = _titres.value.any { it.id == id }

    /** Le fichier à jouer, s'il est là : la lecture le prend avant le réseau (6.2). */
    fun fichier(id: String): File? = audio(id).takeIf { it.exists() && estTelecharge(id) }

    fun adressePochette(id: String): String? = pochette(id).takeIf { it.exists() }?.let { "file://${it.absolutePath}" }

    /** Un titre téléchargé, prêt pour le lecteur : pochette locale, artiste connu. */
    fun versTitre(t: TitreTelecharge) = Titre(
        id = t.id,
        title = t.titre,
        artist = t.artisteId?.let { ArtisteCourt(it, t.artiste, t.verifie) },
        coverUrl = adressePochette(t.id),
        duration = t.duree,
    )

    fun marquerEcoute(id: String) {
        if (estTelecharge(id)) ecrireIndex { liste -> liste.map { if (it.id == id) it.copy(ecouteLe = System.currentTimeMillis()) else it } }
    }

    /** Télécharge un titre ; déjà présent, il n'est pas retéléchargé. */
    suspend fun telecharger(titre: Titre, qualite: String, source: String = "manual") = withContext(Dispatchers.IO) {
        if (estTelecharge(titre.id)) return@withContext
        // Déjà sur le téléphone pour un autre compte : le fichier est partagé plutôt que retéléchargé.
        if (audio(titre.id).exists()) {
            val octets = audio(titre.id).length()
            ecrireIndex { liste ->
                listOf(
                    TitreTelecharge(
                        id = titre.id, titre = titre.title, artiste = titre.artist?.stageName, artisteId = titre.artist?.id,
                        verifie = titre.artist?.verified == true, duree = titre.duration, qualite = qualite, octets = octets, source = source,
                    ),
                ) + liste.filter { it.id != titre.id }
            }
            return@withContext
        }
        _enCours.update { it + (titre.id to 0f) }
        val provisoire = File(dossier, "${titre.id}.partiel")
        try {
            val requete = Request.Builder().url("${site}api/stream/${titre.id}?q=$qualite").build()
            val octets = client.newCall(requete).execute().use { r ->
                if (r.code == 403 || r.code == 404) throw TitreIndisponible(messageDuCorps(r.body?.string()) ?: "Ce titre n'est pas disponible.")
                if (!r.isSuccessful) throw IOException(messageDuCorps(r.body?.string()) ?: "Téléchargement refusé (${r.code}).")
                val corps = r.body ?: throw IOException("Réponse vide.")
                val total = corps.contentLength()
                var lus = 0L
                provisoire.outputStream().use { sortie ->
                    corps.byteStream().use { entree ->
                        val tampon = ByteArray(64 * 1024)
                        while (true) {
                            val n = entree.read(tampon)
                            if (n < 0) break
                            sortie.write(tampon, 0, n)
                            lus += n
                            if (total > 0) _enCours.update { it + (titre.id to lus.toFloat() / total) }
                        }
                    }
                }
                lus
            }
            if (!provisoire.renameTo(audio(titre.id))) throw IOException("Enregistrement impossible.")
            // La pochette n'est qu'un plus : son échec n'annule pas le titre.
            adresseMedia(titre.coverUrl, site)?.let { adresse ->
                runCatching {
                    client.newCall(Request.Builder().url(adresse).build()).execute().use { r ->
                        if (r.isSuccessful) r.body?.byteStream()?.use { e -> pochette(titre.id).outputStream().use { e.copyTo(it) } }
                    }
                }
            }
            // Les paroles aussi, pour les suivre sans réseau ; un titre sans paroles n'en a pas besoin.
            runCatching {
                client.newCall(Request.Builder().url("${site}api/songs/${titre.id}/lyrics").build()).execute().use { r ->
                    val brut = r.body?.string()?.takeIf { r.isSuccessful }?.let { JsonMoziik.decodeFromString(ReponseParoles.serializer(), it).raw }
                    if (!brut.isNullOrBlank()) paroles(titre.id).writeText(brut)
                }
            }
            ecrireIndex { liste ->
                listOf(
                    TitreTelecharge(
                        id = titre.id, titre = titre.title, artiste = titre.artist?.stageName, artisteId = titre.artist?.id,
                        verifie = titre.artist?.verified == true, duree = titre.duration, qualite = qualite, octets = octets, source = source,
                    ),
                ) + liste.filter { it.id != titre.id }
            }
        } finally {
            provisoire.delete()
            _enCours.update { it - titre.id }
        }
    }

    fun supprimer(id: String) {
        effacer(id)
        ecrireIndex { liste -> liste.filter { it.id != id } }
    }

    fun toutSupprimer() {
        _titres.value.forEach { effacer(it.id) }
        ecrireIndex { emptyList() }
    }

    /** Retire les titres non écoutés depuis 90 jours (ou depuis leur téléchargement), et dit combien (6.3). */
    fun nettoyer(jours: Int = 90): Int {
        val limite = System.currentTimeMillis() - jours * 86_400_000L
        val anciens = _titres.value.filter { (it.ecouteLe ?: it.telechargeLe) < limite }
        anciens.forEach { effacer(it.id) }
        ecrireIndex { liste -> liste.filter { t -> anciens.none { it.id == t.id } } }
        return anciens.size
    }

    /** La place prise par les titres du compte connecté, pas par ceux des autres comptes du téléphone. */
    fun espaceUtilise(): Long = _titres.value.sumOf { audio(it.id).length() + pochette(it.id).length() + paroles(it.id).length() }

    fun espaceLibre(): Long = dossier.usableSpace
}
