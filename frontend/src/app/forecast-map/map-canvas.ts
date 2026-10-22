import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ImageSource, Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { GridPoint } from '../forecast/forecast-types';
import { ColorScale } from '../map-render/color-scale';
import { GridImage, gridToImage } from '../map-render/grid-image';

/**
 * MapLibre 6 ładuje worker z osobnego pliku, którego bundler Angulara sam nie dołącza.
 * Kopiuje go `angular.json` (sekcja `assets`) do `maplibre/`.
 */
const WORKER_URL = new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href;

const STYLE_URL ='https://tiles.openfreemap.org/styles/positron';
const SOURCE_ID = 'forecast-raster';
const LAYER_ID = 'forecast-raster';

/** Prostokąt z marginesem wokół Polski, w kolejności [zachód, południe, wschód, północ]. */
const POLAND_BOUNDS: [number, number, number, number] = [13.9, 48.9, 24.3, 55.1];

/** Środek rasteru jest półprzezroczysty, żeby drogi i granice z podkładu prześwitywały. */
const RASTER_OPACITY = 0.7;

/** Rogi obrazu dla MapLibre: lewy górny, prawy górny, prawy dolny, lewy dolny, jako [lon, lat]. */
function cornersOf(image: GridImage): [[number, number], [number, number], [number, number], [number, number]] {
  const { north, south, west, east } = image.bounds;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

/** Jedyne miejsce w aplikacji z kodem MapLibre. Rysuje podkład i nakłada na niego raster prognozy. */
@Component({
  selector: 'app-map-canvas',
  template: `<div
    #container
    class="size-full"
    role="region"
    aria-label="Mapa prognozy pogody dla Polski"
  ></div>`,
  host: { class: 'block size-full' },
})
export class MapCanvas {
  readonly points = input<GridPoint[] | null>(null);
  readonly scale = input.required<ColorScale>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly map = signal<MapLibreMap | null>(null);
  /** Styl Positron ładuje się asynchronicznie. Do zdarzenia `load` nie wolno dodawać warstw. */
  private readonly styleLoaded = signal(false);

  constructor() {
    afterNextRender(() => {
      setWorkerUrl(WORKER_URL);
      const map = new MapLibreMap({
        container: this.container().nativeElement,
        style: STYLE_URL,
        bounds: POLAND_BOUNDS,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.once('load', () => this.styleLoaded.set(true));
      this.map.set(map);

      this.destroyRef.onDestroy(() => map.remove());
    });

    // Dane przychodzące przed `load` czekają w sygnałach, a efekt uruchomi się ponownie po `load`.
    effect(() => {
      const map = this.map();
      if (!map || !this.styleLoaded()) return;

      const points = this.points();
      const image = points ? gridToImage(points, this.scale()) : null;
      this.showRaster(map, image);
    });
  }

  private showRaster(map: MapLibreMap, image: GridImage | null): void {
    if (!image) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
      return;
    }

    const imageData = new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height);
    const coordinates = cornersOf(image);

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'image', coordinates });
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          // Bez wygaszania zmiana obrazu nie miga (przydatne przy suwaku godziny).
          paint: { 'raster-fade-duration': 0, 'raster-opacity': RASTER_OPACITY },
        },
        this.firstSymbolLayerId(map),
      );
    }

    (map.getSource(SOURCE_ID) as ImageSource).updateImage({ image: imageData, coordinates });
    map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
    performance.mark('forecast-raster-drawn');
  }

  /** Raster idzie pod pierwszą warstwę z napisami, żeby etykiety miast zostały nad kolorami. */
  private firstSymbolLayerId(map: MapLibreMap): string | undefined {
    return map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  }
}
