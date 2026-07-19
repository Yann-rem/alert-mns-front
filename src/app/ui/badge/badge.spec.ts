import { TestBed } from '@angular/core/testing';
import { Badge } from './badge';

describe('Badge', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [Badge] }).compileComponents();
    const fixture = TestBed.createComponent(Badge);
    await fixture.whenStable();
    return fixture;
  }

  it('se crée', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('filled : fond + texte de la tonalité', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('tone', 'success');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.className).toContain('bg-success-subtle');
    expect(el.className).toContain('text-success-text');
  });

  it('outline : bordure, fond transparent', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('variant', 'outline');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.className).toContain('bg-transparent');
    expect(el.className).toContain('border-border-default');
  });
});
