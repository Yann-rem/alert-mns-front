import { TestBed } from '@angular/core/testing';
import { Toggle } from './toggle';

describe('Toggle', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [Toggle] }).compileComponents();
    const fixture = TestBed.createComponent(Toggle);
    await fixture.whenStable();
    return fixture;
  }

  it('off par défaut : aria-checked false et piste grise', async () => {
    const fixture = await setup();
    const btn = fixture.nativeElement.querySelector('button') as HTMLElement;
    expect(btn.getAttribute('aria-checked')).toBe('false');
    expect(btn.className).toContain('bg-border-strong');
  });

  it('clic : bascule à on', async () => {
    const fixture = await setup();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.click();
    await fixture.whenStable();
    expect(btn.getAttribute('aria-checked')).toBe('true');
    expect(btn.className).toContain('bg-accent-solid');
    expect(fixture.componentInstance.checked()).toBe(true);
  });

  it('désactivé : le clic ne bascule pas', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    btn.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.checked()).toBe(false);
  });
});
