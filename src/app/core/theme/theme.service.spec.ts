import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  /** L'effet d'application ne part qu'au premier cycle : le tick le déclenche. */
  function start(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  it('démarre en clair quand rien n’est stocké ni préféré', () => {
    const service = start();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reprend le thème retenu à la visite précédente', () => {
    localStorage.setItem('alerte.theme', 'dark');

    const service = start();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('bascule le document et retient le choix', () => {
    const service = start();

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('alerte.theme')).toBe('dark');

    service.toggle();
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('alerte.theme')).toBe('light');
  });

  it('suit la préférence système en l’absence de choix retenu', () => {
    // jsdom ne fournit pas `matchMedia` : il faut l'installer pour ce test, ce qui montre au
    // passage pourquoi le service se garde de l'appeler sans vérifier qu'il existe.
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;

    const service = start();

    expect(service.theme()).toBe('dark');
    window.matchMedia = original;
  });

  it('démarre malgré un stockage indisponible', () => {
    // Navigation privée stricte, cookies bloqués : l'accès lève au lieu de renvoyer null.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage bloqué');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage bloqué');
    });

    const service = start();

    expect(service.theme()).toBe('light');
    expect(() => {
      service.toggle();
      TestBed.tick();
    }).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
