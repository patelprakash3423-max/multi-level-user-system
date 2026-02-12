import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownlineTree } from './downline-tree';

describe('DownlineTree', () => {
  let component: DownlineTree;
  let fixture: ComponentFixture<DownlineTree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownlineTree]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DownlineTree);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
