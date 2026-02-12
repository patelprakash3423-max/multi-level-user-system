import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HierarchyNode } from './hierarchy-node';

describe('HierarchyNode', () => {
  let component: HierarchyNode;
  let fixture: ComponentFixture<HierarchyNode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HierarchyNode]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HierarchyNode);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
