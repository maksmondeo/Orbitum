import { TestBed } from '@angular/core/testing';
import { HourValue, Variable } from '../forecast/forecast-types';
import { DayTable } from './day-table';
import { summarizeDays } from './daily-summary';

const at = (iso: string, value: number): HourValue => ({ validTime: new Date(iso), value });

/** Dni z godzin, „teraz” ustawione przed pierwszą z nich. */
const daysOf = (values: HourValue[]) => summarizeDays(values, new Date('2026-10-20T00:00:00Z'));

describe('DayTable', () => {
  function setup(values: HourValue[], variable: Variable = 'temperature_2m') {
    const fixture = TestBed.createComponent(DayTable);
    fixture.componentRef.setInput('days', daysOf(values));
    fixture.componentRef.setInput('variable', variable);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const buttons = () => host.querySelectorAll<HTMLButtonElement>('tbody button');
    const click = (button: HTMLButtonElement) => {
      button.click();
      fixture.detectChanges();
    };
    return { host, buttons, click };
  }

  it('ma wiersz na każdy dzień, zwinięty, z min i max', () => {
    const { host, buttons } = setup([
      at('2026-10-22T10:00:00Z', 5),
      at('2026-10-22T12:00:00Z', 9),
      at('2026-10-23T10:00:00Z', 3),
    ]);

    expect(buttons().length).toBe(2);
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelectorAll('tbody tr').length).toBe(2);
    expect(host.querySelector('tbody tr')?.textContent).toContain('czw. 22.10');
    expect(host.querySelector('tbody tr')?.textContent).toContain('5,0 °C');
    expect(host.querySelector('tbody tr')?.textContent).toContain('9,0 °C');
  });

  it('kliknięcie przycisku rozwija godziny tylko tego dnia', () => {
    const { host, buttons, click } = setup([
      at('2026-10-22T10:00:00Z', 5),
      at('2026-10-22T12:00:00Z', 9),
      at('2026-10-23T10:00:00Z', 3),
    ]);

    click(buttons()[0]);

    expect(buttons()[0].getAttribute('aria-expanded')).toBe('true');
    expect(buttons()[1].getAttribute('aria-expanded')).toBe('false');
    // 2 wiersze dni + 2 godziny pierwszego dnia
    expect(host.querySelectorAll('tbody tr').length).toBe(4);
    expect(host.textContent).toContain('12:00');
  });

  it('dzień niepełny ma opis „od” i „do”', () => {
    const { buttons } = setup([at('2026-10-22T04:00:00Z', 5), at('2026-10-22T18:00:00Z', 6)]);

    // 06:00 i 20:00 czasu polskiego (CEST)
    expect(buttons()[0].textContent).toContain('od 06:00 do 20:00');
  });

  it('wartość ujemna ma minus, a ciśnienie jest w pełnych hPa', () => {
    const cold = setup([at('2026-10-22T10:00:00Z', -0.4)]);
    expect(cold.host.textContent).toContain('−0,4 °C');

    const pressure = setup([at('2026-10-22T10:00:00Z', 1013.4)], 'pressure_msl');
    expect(pressure.host.textContent).toContain('1013 hPa');
  });

  it('doba zmiany czasu ma dwa wiersze 02:00, CEST i CET', () => {
    const { host, buttons, click } = setup([
      at('2026-10-25T00:00:00Z', 10),
      at('2026-10-25T01:00:00Z', 11),
    ]);

    click(buttons()[0]);

    expect(host.textContent).toContain('02:00 CEST');
    expect(host.textContent).toContain('02:00 CET');
  });
});
