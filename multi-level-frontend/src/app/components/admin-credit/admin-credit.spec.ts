import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCredit } from './admin-credit';

describe('AdminCredit', () => {
  let component: AdminCredit;
  let fixture: ComponentFixture<AdminCredit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCredit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCredit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
