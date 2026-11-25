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

import {DOCUMENT} from '@angular/common';
import {inject, Injectable} from '@angular/core';

/**
 * Common query parameters of MTT UI2, which persist in memory across the
 * client-side SPA navigations and are forwarded to the embedded LabConsole
 * (MHFE V6) iframe.
 *
 * The `force_*_ready` keys are LabConsole developer flags: they are forwarded
 * so that features still under development (e.g. host/device action buttons)
 * can be previewed inside MTT.
 *
 * The `force_ready` key takes a comma-separated list of features to force on
 * (see ForceReadyFeature), e.g. `force_ready=search` for the LabConsole search
 * pages, which replace the UI2 Devices / Hosts list pages (see
 * resolveAppData). LabConsole keeps it on its own navigations as well, and
 * reads its own features from it, e.g. `force_ready=config`. The
 * `force_all_ready` global switch implies every feature of both.
 */
export const COMMON_QUERY_PARAMS = [
  'debug',
  'fake_data',
  'force_host_ready',
  'force_device_ready',
  'force_all_ready',
  'force_ready',
] as const;

/** Key type of the supported common query parameters. */
export type CommonQueryParamKey = (typeof COMMON_QUERY_PARAMS)[number];

const COMMON_QUERY_PARAM_SET: ReadonlySet<string> = new Set<string>(
  COMMON_QUERY_PARAMS,
);

/** Features that the `force_ready` common query parameter can force on. */
export enum ForceReadyFeature {
  /** The LabConsole search pages, in place of the UI2 Devices / Hosts lists. */
  SEARCH = 'search',
}

/**
 * Checks whether a query parameter is a common query parameter.
 *
 * @param key The query parameter key.
 * @return True if the key is one of COMMON_QUERY_PARAMS, false otherwise.
 */
export function isCommonQueryParam(key: string): key is CommonQueryParamKey {
  return COMMON_QUERY_PARAM_SET.has(key);
}

/**
 * Checks whether the `force_ready` common query parameter forces a feature on.
 *
 * @param commonParams The common query parameters (see CommonParamsService).
 * @param feature The feature to check.
 * @return True if the comma-separated `force_ready` value lists the feature,
 *     ignoring surrounding whitespace and case, or if the `force_all_ready`
 *     global switch is on (any value other than '', '0' or 'false', ignoring
 *     case, as in LabConsole); false otherwise.
 */
export function isForceReady(
  commonParams: Readonly<Record<string, string>>,
  feature: ForceReadyFeature,
): boolean {
  const forceAllReady = commonParams['force_all_ready'];
  return (
    (forceAllReady !== undefined &&
      !['', '0', 'false'].includes(forceAllReady.toLowerCase())) ||
    (commonParams['force_ready'] ?? '')
      .split(',')
      .some((name) => name.trim().toLowerCase() === feature)
  );
}

/**
 * Parses the active common query parameters from a URL search string.
 *
 * @param search The URL search string (e.g. '?debug=true&fake_data=1').
 * @return Frozen record of the active common query parameters.
 *
 * Explanation:
 * Like LabConsole's CommonParamsService, every common query parameter with a
 * non-empty value is captured as is (e.g. 'debug=false' or
 * 'force_ready=search'). Whether a flag is on is decided where it is used,
 * e.g. by isForceReady.
 */
export function parseCommonQueryParams(
  search: string,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search).entries()) {
    if (isCommonQueryParam(key) && value !== '') {
      result[key] = value;
    }
  }
  return Object.freeze(result);
}

/**
 * Service capturing the Common Query Parameters of MTT UI2 (e.g. debug,
 * fake_data).
 *
 * The common query parameters are captured once from the initial page URL
 * when this service is instantiated, which happens when the root `Mtt`
 * component is created at SPA bootstrap (i.e. before the initial navigation).
 * They are then preserved in memory across the client-side SPA navigations for
 * the tab's lifetime, naturally reset on a full page reload (Ctrl+R), and do
 * not leak across tabs.
 *
 * Being an injectable service instead of a module-level mutable variable, each
 * TestBed gets its own isolated instance, so unit tests can provide a fake
 * DOCUMENT (or a fake service) without mutating any global state.
 */
@Injectable({providedIn: 'root'})
export class CommonParamsService {
  private readonly document = inject(DOCUMENT);

  /** Immutable record of the active common query parameters. */
  private readonly commonParams = parseCommonQueryParams(
    this.document.defaultView?.location.search ?? '',
  );

  /**
   * Returns the active common query parameters captured at SPA bootstrap.
   *
   * @return Immutable record of the active common query parameters (e.g.
   *     {'debug': 'true'}), or an empty record if none is active.
   */
  getCommonParams(): Readonly<Record<string, string>> {
    return this.commonParams;
  }
}
