import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recharge } from './recharge';

describe('Recharge', () => {
  let component: Recharge;
  let fixture: ComponentFixture<Recharge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recharge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recharge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
