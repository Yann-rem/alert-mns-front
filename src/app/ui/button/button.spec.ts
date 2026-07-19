import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button, type ButtonVariant } from './button';

@Component({
  imports: [Button],
  template: `<button appButton [variant]="variant()" [disabled]="disabled()">Go</button>`,
})
class HostComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly disabled = input(false);
}

describe('Button', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('rend un <button> natif avec le contenu projeté', async () => {
    const fixture = await setup();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe('Go');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('applique la variante primaire par défaut', async () => {
    const fixture = await setup();
    const btn = fixture.nativeElement.querySelector('button') as HTMLElement;
    expect(btn.className).toContain('bg-accent-solid');
  });

  it('bascule sur la variante danger', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('variant', 'danger');
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('button') as HTMLElement;
    expect(btn.className).toContain('bg-danger-solid');
  });

  it('reflète l’état désactivé sur l’attribut natif', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
