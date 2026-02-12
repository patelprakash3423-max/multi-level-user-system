import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanceStatement } from './balance-statement';

describe('BalanceStatement', () => {
  let component: BalanceStatement;
  let fixture: ComponentFixture<BalanceStatement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanceStatement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalanceStatement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
