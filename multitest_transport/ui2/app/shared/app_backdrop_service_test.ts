/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {TestBed} from '@angular/core/testing';

import {AppBackdropService, AppBackdropState} from './app_backdrop_service';

describe('AppBackdropService', () => {
  let service: AppBackdropService;
  let states: AppBackdropState[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppBackdropService);
    states = [];
    service.state$.subscribe((state) => {
      states.push(state);
    });
  });

  it('is hidden initially', () => {
    expect(states).toEqual([{visible: false, clipPath: 'none'}]);
  });

  it('shows the backdrop and moves its hole', () => {
    service.show('polygon(evenodd, a)');
    service.show('polygon(evenodd, b)');

    expect(states.slice(1)).toEqual([
      {visible: true, clipPath: 'polygon(evenodd, a)'},
      {visible: true, clipPath: 'polygon(evenodd, b)'},
    ]);
  });

  it('keeps the hole when hiding the backdrop', () => {
    service.show('polygon(evenodd, a)');
    service.hide();

    expect(service.state$.value)
        .toEqual({visible: false, clipPath: 'polygon(evenodd, a)'});
  });

  it('does not emit unchanged states', () => {
    service.hide();
    service.show('polygon(evenodd, a)');
    service.show('polygon(evenodd, a)');
    service.hide();
    service.hide();

    expect(states.length).toBe(3);
  });
});
