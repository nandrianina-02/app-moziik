package com.moziik.app.lecteur

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Le Bass Boost dans le lecteur : la chaîne de ChaineBasses appliquée au son
 * décodé, avant la sortie. Branché en permanence ; au niveau Off il recopie
 * le son sans le toucher, ce qui permet de changer de niveau en pleine
 * lecture, sans couper le morceau.
 */
@OptIn(UnstableApi::class)
class TraitementBasses : BaseAudioProcessor() {
    val chaine = ChaineBasses()
    private var tampon = FloatArray(0)

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
        // Le décodage MP3 du lecteur sort du PCM 16 bits ; tout autre format passe sans traitement.
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) return AudioFormat.NOT_SET
        chaine.configurer(inputAudioFormat.sampleRate, inputAudioFormat.channelCount)
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val octets = inputBuffer.remaining()
        if (octets == 0) return
        if (chaine.reglage.neutre) {
            // Off : le son passe à l'octet près, sans conversion.
            replaceOutputBuffer(octets).put(inputBuffer).flip()
            chaine.reinitialiser()
            return
        }
        val entree = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
        val nombre = octets / 2
        if (tampon.size < nombre) tampon = FloatArray(nombre)
        val debut = entree.position()
        for (i in 0 until nombre) tampon[i] = entree.getShort(debut + 2 * i) / 32768f
        inputBuffer.position(inputBuffer.limit())
        chaine.traiter(tampon, nombre)
        val sortie = replaceOutputBuffer(octets).order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until nombre) {
            val v = (tampon[i] * 32767f).coerceIn(-32768f, 32767f)
            sortie.putShort(v.toInt().toShort())
        }
        sortie.flip()
    }

    override fun onFlush() = chaine.reinitialiser()

    override fun onReset() {
        tampon = FloatArray(0)
        chaine.reinitialiser()
    }
}
