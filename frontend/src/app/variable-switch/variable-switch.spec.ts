import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Variable } from '../forecast/forecast-types';
import { VariableSwitch } from './variable-switch';

@Component({
  imports: [VariableSwitch],
  template: `
    <app-variable-switch name="first" [(value)]="first" />
    <app-variable-switch name="second" [(value)]="second" />
  `,
})
class Host {
  readonly first = signal<Variable>('temperature_2m');
  readonly second = signal<Variable>('temperature_2m');
}

describe('VariableSwitch', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const radios = (group: string) => host.querySelectorAll<HTMLInputElement>(`input[name=${group}]`);
    return { fixture, radios };
  }

  it('kliknięcie drugiej opcji zmienia wartość', () => {
    const { fixture, radios } = setup();

    radios('first')[1].click();

    expect(fixture.componentInstance.first()).toBe('pressure_msl');
  });

  it('przełączniki z różnym name nie dzielą grupy', () => {
    const { fixture, radios } = setup();

    radios('first')[1].click();
    fixture.detectChanges();

    expect(radios('second')[0].checked).toBe(true);
    expect(fixture.componentInstance.second()).toBe('temperature_2m');
  });
});
