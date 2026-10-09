/**
 * Transition d'une page à l'autre.
 *
 * Un `template` est remonté à chaque navigation, à la différence du layout :
 * c'est l'endroit où une page qui arrive peut entrer, sans que le lecteur,
 * la barre latérale ou l'en-tête (dans le layout) ne bougent.
 *
 * L'entrée est courte et discrète (voir `.entree-page` dans globals.css), et
 * ne laisse aucune transformation derrière elle : un `transform` resté en
 * place ferait du conteneur la référence des éléments `position: fixed` des
 * pages (fenêtres, menus), qui se décaleraient.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="entree-page">{children}</div>;
}
