import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransferBalance } from './transfer-balance';

describe('TransferBalance', () => {
  let component: TransferBalance;
  let fixture: ComponentFixture<TransferBalance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferBalance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransferBalance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
