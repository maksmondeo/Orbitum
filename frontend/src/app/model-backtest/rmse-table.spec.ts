import { TestBed } from '@angular/core/testing';
import { Variable } from '../forecast/forecast-types';
import { BacktestBucket } from './backtest-api';
import { RmseTable } from './rmse-table';

const buckets: BacktestBucket[] = [
  { fromHour: 1, toHour: 6, best: 'A', rmse: { A: 1.2, B: 2 } },
  // best = B, choć A ma mniejszy RMSE (model A nie przeszedł progu pokrycia)
  { fromHour: 7, toHour: 12, best: 'B', rmse: { A: 1, B: 2.5 } },
  // B nie ma liczby
  { fromHour: 13, toHour: 18, best: 'A', rmse: { A: 3 } },
];

describe('RmseTable', () => {
  function setup(models = ['A', 'B'], variable: Variable = 'temperature_2m') {
    const fixture = TestBed.createComponent(RmseTable);
    fixture.componentRef.setInput('buckets', buckets);
    fixture.componentRef.setInput('models', models);
    fixture.componentRef.setInput('variable', variable);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const rows = () => Array.from(host.querySelectorAll('tbody tr'));
    const cells = (row: number) => Array.from(rows()[row].querySelectorAll('td'));
    return { host, rows, cells };
  }

  it('ma wiersz na przedział i liczby z przecinkiem', () => {
    const { rows, cells } = setup();

    expect(rows().length).toBe(3);
    expect(rows()[0].querySelector('th')?.textContent).toContain('1–6 h');
    expect(cells(0)[0].textContent).toContain('1,20');
    expect(cells(0)[1].textContent).toContain('2,00');
  });

  it('▲ stoi przy best, także gdy to nie najmniejsza liczba w wierszu', () => {
    const { cells } = setup();

    expect(cells(1)[0].textContent).not.toContain('▲');
    expect(cells(1)[1].textContent).toContain('▲');
    expect(cells(1)[1].textContent).toContain('najmniejszy błąd');
  });

  it('brak liczby to „—” z tekstem dla czytnika', () => {
    const { cells } = setup();

    expect(cells(2)[1].textContent).toContain('—');
    expect(cells(2)[1].textContent).toContain('brak danych');
  });

  it('kolumny idą w kolejności z models', () => {
    const { host } = setup(['B', 'A']);

    const headers = Array.from(host.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Horyzont', 'B', 'A']);
  });

  it('jednostka w podpisie wynika ze zmiennej', () => {
    const { host } = setup(['A', 'B'], 'pressure_msl');

    expect(host.querySelector('caption')?.textContent).toContain('hPa');
  });

  it('kontener przewijania da się obsłużyć klawiaturą', () => {
    const { host } = setup();

    const region = host.querySelector('[role="region"]');
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.getAttribute('aria-label')).toBeTruthy();
  });
});
