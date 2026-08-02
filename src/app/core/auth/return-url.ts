import { Router, UrlTree } from '@angular/router';

/** Paramètre de requête portant la destination initialement demandée. */
export const RETURN_URL_PARAM = 'returnUrl';

/** Écran d'atterrissage par défaut, quand aucune destination n'a été mémorisée. */
export const DEFAULT_LANDING_URL = '/messages';

/**
 * Filtre une destination de retour avant de s'en servir pour naviguer.
 *
 * <p>La valeur transite par l'URL : elle vient donc de l'extérieur et n'est pas
 * digne de confiance. La reprendre telle quelle ouvrirait une <b>redirection non
 * maîtrisée</b> (CWE-601) — il suffirait de diffuser
 * `…/connexion?returnUrl=https://faux-alerte.example` pour qu'une victime, après
 * s'être authentifiée pour de bon sur le vrai site, atterrisse sur une copie
 * convaincue de n'avoir jamais quitté Alerte.</p>
 *
 * <p>Seuls les chemins internes sont acceptés : une barre oblique initiale, mais
 * ni `//` ni `/\`, que les navigateurs interprètent comme le début d'une URL
 * absolue privée de son protocole.</p>
 *
 * @returns la destination si elle est interne, `null` sinon
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value.startsWith('//') || value.startsWith('/\\') ? null : value;
}

/**
 * Construit l'URL de l'écran de connexion en y mémorisant la destination
 * demandée, pour y ramener l'utilisateur une fois authentifié.
 */
export function loginUrlTree(router: Router, requestedUrl: string | null | undefined): UrlTree {
  const returnUrl = safeReturnUrl(requestedUrl);
  // La racine ne fait que rediriger vers cet écran : la mémoriser n'apporte rien.
  const worthKeeping = returnUrl !== null && returnUrl !== '/';
  return router.createUrlTree(
    ['/connexion'],
    worthKeeping ? { queryParams: { [RETURN_URL_PARAM]: returnUrl } } : {},
  );
}
