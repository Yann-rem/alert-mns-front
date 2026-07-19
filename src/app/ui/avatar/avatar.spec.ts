import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    const fixture = TestBed.createComponent(Avatar);
    await fixture.whenStable();
    return fixture;
  }

  it('affiche les initiales', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('initials', 'JM');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('JM');
  });

  it('sans présence : aucune pastille', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('span')).toBeNull();
  });

  it('présence online : pastille verte', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('presence', 'online');
    await fixture.whenStable();
    const dot = fixture.nativeElement.querySelector('span') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.className).toContain('bg-presence-online');
  });

  it('taille lg : dimensions correspondantes', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('size', 'lg');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).className).toContain('w-12');
  });
});
