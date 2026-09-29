import type {
  MiniAppView,
  ViewElementName,
} from "../../mini-app/src/view.js";

export interface FakeElement {
  readonly name: ViewElementName;
  readonly classes: string[];
  readonly attributes: Map<string, string>;
  readonly children: FakeElement[];
  text: string | null;
  hidden: boolean;
  imageAlternative: string | null;
  imageReferrerPolicy: string | null;
  imageSource: string | null;
  imageErrorHandler: (() => void) | null;
}

function asFakeElement(value: unknown): FakeElement {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    !("children" in value)
  ) {
    throw new TypeError("Expected a fake Mini App element");
  }

  return value as FakeElement;
}

export class FakeMiniAppView implements MiniAppView {
  readonly root: FakeElement[] = [];
  readonly operations: string[] = [];
  readonly events: string[];

  constructor(events: string[] = []) {
    this.events = events;
  }

  clear(): void {
    this.root.length = 0;
    this.operations.push("clear");
  }

  createElement(name: ViewElementName): unknown {
    const created: FakeElement = {
      name,
      classes: [],
      attributes: new Map(),
      children: [],
      text: null,
      hidden: false,
      imageAlternative: null,
      imageReferrerPolicy: null,
      imageSource: null,
      imageErrorHandler: null,
    };
    this.operations.push(`create:${name}`);
    return created;
  }

  addClass(value: unknown, className: string): void {
    asFakeElement(value).classes.push(className);
    this.operations.push(`class:${className}`);
  }

  setText(value: unknown, text: string): void {
    asFakeElement(value).text = text;
    this.operations.push(`text:${text}`);
  }

  setAttribute(value: unknown, name: string, attributeValue: string): void {
    asFakeElement(value).attributes.set(name, attributeValue);
    this.operations.push(`attribute:${name}=${attributeValue}`);
  }

  setHidden(value: unknown, hidden: boolean): void {
    asFakeElement(value).hidden = hidden;
    this.operations.push(`hidden:${hidden}`);
  }

  setImageAlternative(value: unknown, alternative: string): void {
    asFakeElement(value).imageAlternative = alternative;
    this.operations.push(`image-alt:${alternative}`);
  }

  setImageReferrerPolicy(value: unknown, policy: "no-referrer"): void {
    asFakeElement(value).imageReferrerPolicy = policy;
    this.operations.push(`image-referrer:${policy}`);
  }

  setImageSource(value: unknown, source: string): void {
    asFakeElement(value).imageSource = source;
    this.operations.push(`image-source:${source}`);
  }

  onImageError(value: unknown, handler: () => void): void {
    asFakeElement(value).imageErrorHandler = handler;
    this.operations.push("image-error-handler");
  }

  append(parent: unknown, child: unknown): void {
    asFakeElement(parent).children.push(asFakeElement(child));
    this.operations.push("append");
  }

  appendToRoot(value: unknown): void {
    this.root.push(asFakeElement(value));
    this.operations.push("append-root");
    this.events.push("rendered");
  }

  findByClass(className: string): FakeElement | undefined {
    return this.allElements().find((element) =>
      element.classes.includes(className)
    );
  }

  visibleText(): string[] {
    return this.allElements()
      .filter((element) => !element.hidden && element.text !== null)
      .map((element) => element.text as string);
  }

  dispatchImageError(): void {
    const image = this.findByClass("profile-card__image");
    if (image?.imageErrorHandler === null || image?.imageErrorHandler === undefined) {
      throw new Error("No image error handler was registered");
    }
    image.imageErrorHandler();
  }

  private allElements(): FakeElement[] {
    const result: FakeElement[] = [];
    const visit = (element: FakeElement): void => {
      result.push(element);
      element.children.forEach(visit);
    };
    this.root.forEach(visit);
    return result;
  }
}
