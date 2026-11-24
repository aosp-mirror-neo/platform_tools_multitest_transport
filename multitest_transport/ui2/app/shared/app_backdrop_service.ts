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

import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

/** State of the app backdrop. */
export interface AppBackdropState {
  /** Whether the backdrop is shown. */
  readonly visible: boolean;
  /**
   * CSS clip-path of the backdrop: the whole viewport except the area in
   * which the embedded Lab Console iframe is visible, as the iframe dims that
   * area itself.
   */
  readonly clipPath: string;
}

/**
 * Dims the whole app while a dialog of the embedded Lab Console (V6) is open.
 *
 * The dialog's own backdrop only covers the iframe, so the app root renders
 * this backdrop over the rest of the page (side navigation, header, footer),
 * leaving out the area in which the iframe is visible. The V6 iframe container
 * shows and hides it when the Lab Console reports the state of its dialogs'
 * backdrop (EMBEDDED_BACKDROP_CHANGED message).
 */
@Injectable({providedIn: 'root'})
export class AppBackdropService {
  /** Current state of the backdrop, hidden until a dialog is opened. */
  readonly state$ =
      new BehaviorSubject<AppBackdropState>({visible: false, clipPath: 'none'});

  /**
   * Shows the backdrop, or moves its hole when already shown.
   *
   * @param clipPath CSS clip-path of the backdrop, leaving out the area of
   *     the iframe.
   */
  show(clipPath: string): void {
    const state = this.state$.value;
    if (!state.visible || state.clipPath !== clipPath) {
      this.state$.next({visible: true, clipPath});
    }
  }

  /**
   * Hides the backdrop.
   *
   * Explanation:
   * The hole is kept, so that the backdrop does not cover the iframe while it
   * fades out together with the dialog's own backdrop.
   */
  hide(): void {
    const state = this.state$.value;
    if (state.visible) {
      this.state$.next({...state, visible: false});
    }
  }
}
