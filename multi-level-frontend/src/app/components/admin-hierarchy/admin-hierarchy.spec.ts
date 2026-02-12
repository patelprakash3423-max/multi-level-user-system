import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminHierarchy } from './admin-hierarchy';

describe('AdminHierarchy', () => {
  let component: AdminHierarchy;
  let fixture: ComponentFixture<AdminHierarchy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminHierarchy]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminHierarchy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
