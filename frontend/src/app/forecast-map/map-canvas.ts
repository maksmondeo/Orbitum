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
import { FillLayerSpecification, ImageSource, LineLayerSpecification, Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { GridPoint } from '../forecast/forecast-types';
import { ColorScale } from '../map-render/color-scale';
import { GridImage, gridToImage } from '../map-render/grid-image';
import { POLAND_MASK, POLAND_RASTER_CLIP } from '../map-render/poland-mask';

/**
 * MapLibre 6 ładuje worker z osobnego pliku, którego bundler Angulara sam nie dołącza.
 * Kopiuje go `angular.json` (sekcja `assets`) do `maplibre/`.
 */
const WORKER_URL = new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href;

const STYLE_URL ='https://tiles.openfreemap.org/styles/positron';
const SOURCE_ID = 'forecast-raster';
const LAYER_ID = 'forecast-raster';
const MASK_SOURCE_ID = 'poland-mask';
const MASK_LAYER_ID = 'poland-mask';
const SEA_LAYER_ID = 'forecast-sea';
const BORDER_LAYER_ID = 'forecast-border';

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
      const image = points ? gridToImage(points, this.scale(), undefined, POLAND_RASTER_CLIP) : null;
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
      // Raster idzie pod pierwszą warstwę z napisami: drogi, rzeki i lasy prześwitują przez niego,
      // a etykiety miast zostają nad kolorami. Dalsze warstwy wskakują tuż nad raster, w tej kolejności.
      const beforeId = this.firstSymbolLayerId(map);
      map.addSource(SOURCE_ID, { type: 'image', coordinates });
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          // Bez wygaszania zmiana obrazu nie miga (przydatne przy suwaku godziny).
          paint: { 'raster-fade-duration': 0, 'raster-opacity': RASTER_OPACITY },
        },
        beforeId,
      );
      // Maska zakrywa raster poza Polską kolorem tła, czyli tak, jakby rastra tam nie było.
      map.addSource(MASK_SOURCE_ID, { type: 'geojson', data: POLAND_MASK });
      map.addLayer(
        {
          id: MASK_LAYER_ID,
          type: 'fill',
          source: MASK_SOURCE_ID,
          paint: { 'fill-color': this.backgroundColor(map) },
        },
        beforeId,
      );
      // Morze z podkładu rysowane drugi raz nad rastrem: Bałtyk zostaje bez koloru, a wybrzeże jest
      // wektorowe, więc dokładne przy każdym zbliżeniu. Jeziora i rzeki zostają pod rastrem.
      const sea = this.seaLayer(map);
      if (sea) map.addLayer(sea, beforeId);
      // Granica państwa z podkładu też drugi raz, nad maską, żeby była wyraźna wzdłuż krawędzi rastra.
      const border = this.countryBorderLayer(map);
      if (border) map.addLayer(border, beforeId);
    }

    (map.getSource(SOURCE_ID) as ImageSource).updateImage({ image: imageData, coordinates });
    map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
    performance.mark('forecast-raster-drawn');
  }

  /** Raster idzie pod pierwszą warstwę z napisami, żeby etykiety miast zostały nad kolorami. */
  private firstSymbolLayerId(map: MapLibreMap): string | undefined {
    return map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  }

  /** Kopia warstwy wody z podkładu, ograniczona do morza (`class = ocean`), z nowym identyfikatorem. */
  private seaLayer(map: MapLibreMap): FillLayerSpecification | undefined {
    const water = map
      .getStyle()
      .layers.find(
        (layer): layer is FillLayerSpecification =>
          layer.type === 'fill' && layer['source-layer'] === 'water',
      );
    if (!water) return undefined;
    const isSea = ['==', ['get', 'class'], 'ocean'];
    return { ...water, id: SEA_LAYER_ID, filter: ['all', water.filter ?? true, isSea] as never };
  }

  /** Kopia linii granicy państwa z podkładu (w Positron `boundary_2`), z nowym identyfikatorem. */
  private countryBorderLayer(map: MapLibreMap): LineLayerSpecification | undefined {
    const border = map
      .getStyle()
      .layers.find(
        (layer): layer is LineLayerSpecification =>
          layer.type === 'line' && layer.id === 'boundary_2',
      );
    return border && { ...border, id: BORDER_LAYER_ID };
  }

  /** Kolor tła podkładu (u nas to kolor lądu), żeby maska nie była wpisanym na sztywno kolorem. */
  private backgroundColor(map: MapLibreMap): string {
    const background = map.getStyle().layers.find((layer) => layer.type === 'background');
    const color = background && map.getPaintProperty(background.id, 'background-color');
    return typeof color === 'string' ? color : 'white';
  }
}
