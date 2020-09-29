/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Store} from '@ngrx/store';
import {provideMockStore, MockStore} from '@ngrx/store/testing';

import {PluginsContainer} from './plugins_container';
import {PluginsComponent} from './plugins_component';
import {PluginRegistryModule} from './plugin_registry_module';
import {ExtraDashboardModule} from './testing';

import {
  PluginId,
  LoadingMechanismType,
  CustomElementLoadingMechanism,
  IframeLoadingMechanism,
  NgElementLoadingMechanism,
} from '../types/api';
import {DataLoadState} from '../types/data';
import {State} from '../core/store';
import {
  getPlugins,
  getActivePlugin,
  getPluginsListLoaded,
  getEnvironment,
} from '../core/store/core_selectors';
import {PluginsListFailureCode} from '../core/types';
import {TestingDebuggerModule} from '../../plugins/debugger_v2/tf_debugger_v2_plugin/testing';

/** @typehack */ import * as _typeHackStore from '@ngrx/store';

function expectPluginIframe(element: HTMLElement, name: string) {
  expect(element.tagName).toBe('IFRAME');
  expect((element as HTMLIFrameElement).src).toContain(
    `data/plugin_entry.html?name=${name}`
  );
}

/**
 * A Component used to test that custom error templates can be passed to
 * the `plugins` component.
 */
@Component({
  template: `
    <ng-template #environmentFailureNotFoundTemplate>
      <h3 class="custom-not-found-template">Custom Not Found Error</h3>
    </ng-template>
    <ng-template #environmentFailureUnknownTemplate>
      <h3 class="custom-unknown-template">Custom Unknown Error</h3>
    </ng-template>
    <plugins
      [environmentFailureNotFoundTemplate]="environmentFailureNotFoundTemplate"
      [environmentFailureUnknownTemplate]="environmentFailureUnknownTemplate"
    >
    </plugins>
  `,
})
class CustomizedErrorTemplatesComponent {}

class TestableCustomElement extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    wrapper.textContent = 'Test TensorBoard';
    shadow.appendChild(wrapper);
  }
}

customElements.define('tb-bar', TestableCustomElement);

describe('plugins_component', () => {
  let store: MockStore<State>;
  let createElementSpy: jasmine.Spy;

  const PLUGINS = {
    bar: {
      disable_reload: false,
      enabled: true,
      loading_mechanism: {
        type: LoadingMechanismType.CUSTOM_ELEMENT,
        element_name: 'tb-bar',
      } as CustomElementLoadingMechanism,
      tab_name: 'Bar',
      remove_dom: false,
    },
    'extra-plugin': {
      disable_reload: false,
      enabled: true,
      loading_mechanism: {
        type: LoadingMechanismType.NG_COMPONENT,
      } as NgElementLoadingMechanism,
      tab_name: 'Extra',
      remove_dom: false,
    },
    foo: {
      disable_reload: false,
      enabled: true,
      loading_mechanism: {
        type: LoadingMechanismType.IFRAME,
        // This will cause 404 as test bundles do not serve
        // data file in the karma server.
        module_path: 'random_esmodule.js',
      } as IframeLoadingMechanism,
      tab_name: 'Bar',
      remove_dom: false,
    },
  };

  function setActivePlugin(plugin: PluginId) {
    store.overrideSelector(getActivePlugin, plugin);
    store.refreshState();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMockStore(), PluginsContainer, PluginRegistryModule],
      declarations: [
        PluginsContainer,
        PluginsComponent,
        CustomizedErrorTemplatesComponent,
      ],
      imports: [TestingDebuggerModule, ExtraDashboardModule],
    }).compileComponents();
    store = TestBed.inject<Store<State>>(Store) as MockStore<State>;
    store.overrideSelector(getPlugins, PLUGINS);
    store.overrideSelector(getActivePlugin, null);
    store.overrideSelector(getPluginsListLoaded, {
      state: DataLoadState.NOT_LOADED,
      lastLoadedTimeInMs: null,
      failureCode: null,
    });
    store.overrideSelector(getEnvironment, {
      data_location: 'foobar',
      window_title: 'Tests!',
    });

    createElementSpy = spyOn(document, 'createElement').and.callThrough();
    createElementSpy
      .withArgs('tf-experimental-plugin-host-lib')
      .and.returnValue({
        registerPluginIframe: () => {},
      });
  });

  describe('plugin DOM creation', () => {
    it('creates no plugin when there is no activePlugin', () => {
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();
      const el = fixture.debugElement.query(By.css('.plugins'));
      expect(el.nativeElement.childElementCount).toBe(0);
    });

    it('creates no plugin when plugins are not loaded', () => {
      store.overrideSelector(getPlugins, {});
      store.overrideSelector(getActivePlugin, 'foo');
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();
      const el = fixture.debugElement.query(By.css('.plugins'));
      expect(el.nativeElement.childElementCount).toBe(0);
    });

    it('creates an element for CUSTOM_ELEMENT type of plugin', async () => {
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('bar');

      fixture.detectChanges();
      await fixture.whenStable();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      expect(nativeElement.childElementCount).toBe(1);
      const pluginElement = nativeElement.children[0];
      expect(pluginElement.tagName).toBe('TB-BAR');
    });

    it('creates an element for IFRAME type of plugin', async () => {
      const registerPluginIframeSpy = jasmine.createSpy();
      createElementSpy
        .withArgs('tf-experimental-plugin-host-lib')
        .and.returnValue({
          registerPluginIframe: registerPluginIframeSpy,
        });
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('foo');

      fixture.detectChanges();
      await fixture.whenStable();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      expect(nativeElement.childElementCount).toBe(1);
      const pluginElement = nativeElement.children[0];
      expectPluginIframe(pluginElement, 'foo');
      expect(registerPluginIframeSpy).toHaveBeenCalledWith(
        pluginElement,
        'foo'
      );
    });

    it('keeps instance of plugin after being inactive but hides it', async () => {
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('foo');

      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        fixture.debugElement.query(By.css('.plugins')).nativeElement
          .childElementCount
      ).toBe(1);

      setActivePlugin('bar');

      fixture.detectChanges();
      await fixture.whenStable();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      expect(nativeElement.childElementCount).toBe(2);
      const [fooElement, barElement] = nativeElement.children;
      expectPluginIframe(fooElement, 'foo');
      expect(fooElement.style.visibility).toBe('hidden');
      expect(barElement.tagName).toBe('TB-BAR');
      expect(barElement.style.visibility).not.toBe('hidden');
    });

    it('does not create same instance of plugin', async () => {
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('foo');

      fixture.detectChanges();
      await fixture.whenStable();

      setActivePlugin('bar');

      fixture.detectChanges();
      await fixture.whenStable();

      setActivePlugin('foo');

      fixture.detectChanges();
      await fixture.whenStable();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      expect(nativeElement.childElementCount).toBe(2);
      const [fooElement] = nativeElement.children;
      expectPluginIframe(fooElement, 'foo');
      expect(fooElement.style.visibility).not.toBe('hidden');
    });

    it('creates components for plugins registered dynamically', async () => {
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('extra-plugin');

      fixture.detectChanges();
      await fixture.whenStable();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      expect(nativeElement.childElementCount).toBe(1);
      const pluginElement = nativeElement.children[0];
      expect(pluginElement.tagName).toBe('EXTRA-DASHBOARD');
    });

    it('hides inactive plugin but keeps their width', async () => {
      setActivePlugin('bar');

      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      setActivePlugin('foo');
      fixture.detectChanges();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      const [barElement] = nativeElement.children;
      expect(barElement.shadowRoot.firstElementChild.textContent).toBe(
        'Test TensorBoard'
      );
      expect(
        barElement.shadowRoot.firstElementChild.clientWidth
      ).toBeGreaterThan(0);
    });
  });

  describe('updates', () => {
    function setLastLoadedTime(
      timeInMs: number | null,
      state = DataLoadState.LOADED
    ) {
      store.overrideSelector(getPluginsListLoaded, {
        state:
          timeInMs !== null ? DataLoadState.LOADED : DataLoadState.NOT_LOADED,
        lastLoadedTimeInMs: timeInMs,
        failureCode: null,
      });
      store.refreshState();
    }

    it('invokes reload method on the dashboard DOM', () => {
      const fixture = TestBed.createComponent(PluginsContainer);

      setLastLoadedTime(null, DataLoadState.NOT_LOADED);
      setActivePlugin('bar');
      fixture.detectChanges();
      setActivePlugin('foo');
      fixture.detectChanges();
      setActivePlugin('bar');
      fixture.detectChanges();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      // Stamped 'bar' and 'foo'
      expect(nativeElement.children.length).toBe(2);
      const [barElement, fooElement] = nativeElement.children;
      const barReloadSpy = jasmine.createSpy();
      barElement.reload = barReloadSpy;
      const fooReloadSpy = jasmine.createSpy();
      fooElement.reload = fooReloadSpy;

      setLastLoadedTime(1);
      fixture.detectChanges();
      expect(barReloadSpy).toHaveBeenCalledTimes(1);
      expect(fooReloadSpy).not.toHaveBeenCalled();

      setLastLoadedTime(1);
      fixture.detectChanges();
      expect(barReloadSpy).toHaveBeenCalledTimes(1);
      expect(fooReloadSpy).not.toHaveBeenCalled();

      setLastLoadedTime(2);
      fixture.detectChanges();
      expect(barReloadSpy).toHaveBeenCalledTimes(2);
      expect(fooReloadSpy).not.toHaveBeenCalled();

      setActivePlugin('foo');
      fixture.detectChanges();

      setLastLoadedTime(3);
      fixture.detectChanges();
      expect(barReloadSpy).toHaveBeenCalledTimes(2);
      expect(fooReloadSpy).toHaveBeenCalledTimes(1);
    });

    it('does not invoke reload method on dom if disable_reload', () => {
      store.overrideSelector(getPlugins, {
        bar: {
          disable_reload: true,
          enabled: true,
          loading_mechanism: {
            type: LoadingMechanismType.CUSTOM_ELEMENT,
            element_name: 'tb-bar',
          } as CustomElementLoadingMechanism,
          tab_name: 'Bar',
          remove_dom: false,
        },
      });
      const fixture = TestBed.createComponent(PluginsContainer);

      setLastLoadedTime(null, DataLoadState.NOT_LOADED);
      setActivePlugin('bar');
      fixture.detectChanges();

      const {nativeElement} = fixture.debugElement.query(By.css('.plugins'));
      const [barElement] = nativeElement.children;
      const barReloadSpy = jasmine.createSpy();
      barElement.reload = barReloadSpy;

      setLastLoadedTime(1);
      fixture.detectChanges();

      expect(barReloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('warning pages', () => {
    it('does not show any warning while fetching when list was never fetched', () => {
      store.overrideSelector(getPlugins, {});
      store.overrideSelector(getPluginsListLoaded, {
        state: DataLoadState.LOADING,
        lastLoadedTimeInMs: null,
        failureCode: null,
      });
      store.overrideSelector(getActivePlugin, null);

      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.warning'))).toBeNull();
    });

    it('shows warning when plugin id is not known', () => {
      store.overrideSelector(getActivePlugin, 'you_do_not_know_me');
      store.overrideSelector(getPluginsListLoaded, {
        state: DataLoadState.LOADED,
        lastLoadedTimeInMs: 123,
        failureCode: null,
      });
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      expect(fixture.debugElement.nativeElement.textContent).toContain(
        'There’s no dashboard by the name of “you_do_not_know_me”'
      );
    });

    it(
      'shows warning when plugin id is not known when pluginList is cached and' +
        'is loading (updating)',
      () => {
        store.overrideSelector(getPlugins, PLUGINS);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.LOADING,
          lastLoadedTimeInMs: 123,
          failureCode: null,
        });
        store.overrideSelector(getActivePlugin, 'you_do_not_know_me');
        const fixture = TestBed.createComponent(PluginsContainer);
        fixture.detectChanges();

        expect(fixture.debugElement.nativeElement.textContent).toContain(
          'There’s no dashboard by the name of “you_do_not_know_me”'
        );
      }
    );

    it('shows warning when environment failed NOT_FOUND', () => {
      store.overrideSelector(getActivePlugin, null);
      store.overrideSelector(getPluginsListLoaded, {
        state: DataLoadState.FAILED,
        lastLoadedTimeInMs: null,
        failureCode: PluginsListFailureCode.NOT_FOUND,
      });
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      expect(fixture.debugElement.nativeElement.textContent).toContain(
        'Data could not be loaded.'
      );
    });

    it('shows warning when environment failed UNKNOWN', () => {
      store.overrideSelector(getActivePlugin, null);
      store.overrideSelector(getPluginsListLoaded, {
        state: DataLoadState.FAILED,
        lastLoadedTimeInMs: null,
        failureCode: PluginsListFailureCode.UNKNOWN,
      });
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      expect(fixture.debugElement.nativeElement.textContent).toContain(
        'Data could not be loaded.'
      );
    });

    it(
      'shows no active plugin warning even when loading when list was previous ' +
        'loaded',
      () => {
        store.overrideSelector(getActivePlugin, null);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.LOADING,
          lastLoadedTimeInMs: 123,
          failureCode: null,
        });
        const fixture = TestBed.createComponent(PluginsContainer);
        fixture.detectChanges();

        expect(fixture.debugElement.nativeElement.textContent).toContain(
          'No dashboards are active for the current data set.'
        );
      }
    );

    it('shows warning when no plugin is active after list is loaded', () => {
      store.overrideSelector(getActivePlugin, null);
      store.overrideSelector(getPluginsListLoaded, {
        state: DataLoadState.LOADED,
        lastLoadedTimeInMs: 123,
        failureCode: null,
      });
      const fixture = TestBed.createComponent(PluginsContainer);
      fixture.detectChanges();

      expect(fixture.debugElement.nativeElement.textContent).toContain(
        'No dashboards are active for the current data set.'
      );
    });

    describe('custom error templates', () => {
      it('shows warning when environment failed NOT_FOUND', () => {
        store.overrideSelector(getActivePlugin, null);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.FAILED,
          lastLoadedTimeInMs: null,
          failureCode: PluginsListFailureCode.NOT_FOUND,
        });
        const fixture = TestBed.createComponent(
          CustomizedErrorTemplatesComponent
        );
        fixture.detectChanges();

        expect(fixture.debugElement.nativeElement.textContent).toBe(
          'Custom Not Found Error'
        );
      });

      it('shows warning when environment failed UNKNOWN', () => {
        store.overrideSelector(getActivePlugin, null);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.FAILED,
          lastLoadedTimeInMs: null,
          failureCode: PluginsListFailureCode.UNKNOWN,
        });
        const fixture = TestBed.createComponent(
          CustomizedErrorTemplatesComponent
        );
        fixture.detectChanges();

        expect(fixture.debugElement.nativeElement.textContent).toBe(
          'Custom Unknown Error'
        );
      });
    });

    describe('data location', () => {
      it('rendersin the warning', () => {
        store.overrideSelector(getEnvironment, {
          data_location: 'my-location',
          window_title: '',
        });
        store.overrideSelector(getActivePlugin, null);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.LOADED,
          lastLoadedTimeInMs: 123,
          failureCode: null,
        });
        const fixture = TestBed.createComponent(PluginsContainer);
        fixture.detectChanges();

        expect(
          fixture.debugElement.query(By.css('.data-location')).nativeElement
            .textContent
        ).toBe('Log directory: my-location');
      });

      it('does not render when it is empty', () => {
        store.overrideSelector(getEnvironment, {
          data_location: '',
          window_title: '',
        });
        store.overrideSelector(getActivePlugin, null);
        store.overrideSelector(getPluginsListLoaded, {
          state: DataLoadState.LOADED,
          lastLoadedTimeInMs: 123,
          failureCode: null,
        });
        const fixture = TestBed.createComponent(PluginsContainer);
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('.data-location'))).toBeNull();
      });
    });
  });
});
