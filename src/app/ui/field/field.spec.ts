import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Field } from './field';

@Component({
  imports: [Field],
  template: `<input appField [invalid]="invalid()" />`,
})
class HostComponent {
  readonly invalid = input(false);
}

describe('Field', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('style l’input par défaut', async () => {
    const fixture = await setup();
    const input = fixture.nativeElement.querySelector('input') as HTMLElement;
    expect(input.className).toContain('bg-surface-sunken');
    expect(input.className).toContain('border-border-default');
  });

  it('état invalide : bordure danger + aria-invalid', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('invalid', true);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLElement;
    expect(input.className).toContain('border-danger-border');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
