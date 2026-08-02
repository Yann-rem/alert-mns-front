import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';

/** Compteur de portée module : un `id` unique par instance, pour `aria-labelledby`. */
let nextId = 0;

/**
 * Boîte de dialogue modale du design system Alerte.
 *
 * Repose sur l'élément natif `<dialog>` ouvert via `showModal()`. Le navigateur
 * fournit alors le piège à focus, la fermeture par Échap, l'inertie de
 * l'arrière-plan, le rendu en *top layer* (aucun `z-index` à gérer) et le fond
 * `::backdrop` : rien de tout cela n'est réimplémenté.
 *
 * L'ouverture se pilote par liaison bidirectionnelle, pour que la fermeture
 * native (Échap, clic sur le fond) remonte jusqu'au parent :
 *
 * ```html
 * <app-modal [(open)]="showInvite" heading="Inviter un membre">
 *   <form>…</form>
 * </app-modal>
 * ```
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [attr.aria-labelledby]="headingId"
      (close)="open.set(false)"
      (click)="dismissOnBackdrop($event)"
      class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border-default bg-surface-default p-0 text-text-primary shadow-lg backdrop:bg-black/40"
    >
      <div class="flex flex-col gap-4 p-5">
        <div class="flex flex-col gap-1">
          <h2 [id]="headingId" class="text-heading">{{ heading() }}</h2>
          @if (description(); as text) {
            <p class="text-body text-text-secondary">{{ text }}</p>
          }
        </div>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Modal {
  /** Ouverture de la modale. Bidirectionnel : le natif peut fermer de lui-même. */
  readonly open = model.required<boolean>();
  /** Titre, obligatoire : il nomme la boîte de dialogue pour les lecteurs d'écran. */
  readonly heading = input.required<string>();
  /** Texte d'accroche facultatif, sous le titre. */
  readonly description = input<string>();

  protected readonly headingId = `modal-heading-${nextId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect((onCleanup) => {
      const element = this.dialog().nativeElement;
      const shouldBeOpen = this.open();

      // `showModal()` sur une boîte déjà ouverte lève une InvalidStateError.
      if (shouldBeOpen && !element.open) {
        element.showModal();
      } else if (!shouldBeOpen && element.open) {
        element.close();
      }

      // `showModal()` rend l'arrière-plan inerte mais n'en bloque pas le défilement.
      if (shouldBeOpen) {
        document.body.classList.add('overflow-hidden');
        onCleanup(() => document.body.classList.remove('overflow-hidden'));
      }
    });
  }

  /**
   * Ferme sur un clic dans le fond. Le contenu étant un enfant du `<dialog>`,
   * une cible égale au `<dialog>` lui-même désigne forcément la zone hors carte.
   */
  protected dismissOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.open.set(false);
    }
  }
}
