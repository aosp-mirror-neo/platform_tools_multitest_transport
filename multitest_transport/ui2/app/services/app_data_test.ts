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

import {AppData, resolveAppData} from './app_data';

describe('resolveAppData', () => {
  it('should enable the Lab Console search pages with force_ready=search', () => {
    const appData = resolveAppData(
      {enableLabConsoleUI: true},
      {'force_ready': 'search'},
    );
    expect(appData.enableLabConsoleSearchPage).toBeTrue();
  });

  it('should enable the Lab Console search pages when force_ready lists search among other features', () => {
    const appData = resolveAppData(
      {enableLabConsoleUI: true},
      {'force_ready': 'foo,search'},
    );
    expect(appData.enableLabConsoleSearchPage).toBeTrue();
  });

  it('should enable the Lab Console search pages with the force_all_ready global switch', () => {
    const appData = resolveAppData(
      {enableLabConsoleUI: true},
      {'force_all_ready': 'true'},
    );
    expect(appData.enableLabConsoleSearchPage).toBeTrue();
  });

  it('should not enable the Lab Console search pages when force_ready does not list search', () => {
    const appData = resolveAppData(
      {enableLabConsoleUI: true},
      {'force_ready': 'foo'},
    );
    expect(appData.enableLabConsoleSearchPage).toBeFalse();
  });

  it('should not enable the Lab Console search pages without force_ready', () => {
    const appData = resolveAppData({enableLabConsoleUI: true}, {'debug': 'true'});
    expect(appData.enableLabConsoleSearchPage).toBeFalse();
  });

  it('should not enable the Lab Console search pages without the Lab Console UI', () => {
    const appData = resolveAppData(
      {enableLabConsoleUI: false},
      {'force_ready': 'search'},
    );
    expect(appData.enableLabConsoleSearchPage).toBeFalse();
  });

  it('should keep the other application data', () => {
    const appData: AppData = {
      enableLabConsoleUI: true,
      isGoogle: true,
      mttVersion: '1.0',
    };
    expect(resolveAppData(appData, {})).toEqual({
      ...appData,
      enableLabConsoleSearchPage: false,
    });
  });
});
