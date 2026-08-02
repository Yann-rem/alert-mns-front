import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('accepte un chemin interne, paramètres compris', () => {
    expect(safeReturnUrl('/administration')).toBe('/administration');
    expect(safeReturnUrl('/administration?onglet=pending')).toBe('/administration?onglet=pending');
  });

  it('refuse tout ce qui n’est pas un chemin interne', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl('administration')).toBeNull();
  });

  // Le cœur de la protection contre la redirection non maîtrisée (CWE-601) :
  // ces trois formes mènent toutes hors du site.
  it('refuse les URLs menant hors du site', () => {
    expect(safeReturnUrl('https://faux-alerte.example')).toBeNull();
    expect(safeReturnUrl('//faux-alerte.example')).toBeNull();
    expect(safeReturnUrl('/\\faux-alerte.example')).toBeNull();
  });
});
