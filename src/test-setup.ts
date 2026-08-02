/**
 * jsdom fournit l'élément `<dialog>` mais pas son comportement modal : ni
 * `showModal()` ni `close()` n'y sont implémentés (jsdom#3294).
 *
 * <p>Le composant `Modal` s'appuie volontairement sur l'API native — piège à
 * focus, Échap, *top layer* et `::backdrop` gratuits dans un vrai navigateur.
 * On comble donc ici, et seulement pour les tests, ce que le composant utilise :
 * l'attribut `open` et l'événement `close`.</p>
 */
const dialogPrototype = globalThis.HTMLDialogElement?.prototype;

if (dialogPrototype && typeof dialogPrototype.showModal !== 'function') {
  dialogPrototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };

  dialogPrototype.close = function (this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
