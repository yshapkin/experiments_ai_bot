import type { UserInfo } from "./user-info.js";
import { copy } from "./copy.js";

export type ViewElementName =
  | "article"
  | "div"
  | "h1"
  | "dl"
  | "dt"
  | "dd"
  | "img"
  | "p"
  | "span";

export interface MiniAppView {
  clear(): void;
  createElement(name: ViewElementName): unknown;
  addClass(element: unknown, className: string): void;
  setText(element: unknown, text: string): void;
  setAttribute(element: unknown, name: string, value: string): void;
  setHidden(element: unknown, hidden: boolean): void;
  setImageAlternative(image: unknown, alternative: string): void;
  setImageReferrerPolicy(image: unknown, policy: "no-referrer"): void;
  setImageSource(image: unknown, source: string): void;
  onImageError(image: unknown, handler: () => void): void;
  append(parent: unknown, child: unknown): void;
  appendToRoot(element: unknown): void;
}

const en = copy.en;

function element(
  view: MiniAppView,
  name: ViewElementName,
  className?: string,
): unknown {
  const created = view.createElement(name);
  if (className !== undefined) {
    view.addClass(created, className);
  }
  return created;
}

function textElement(
  view: MiniAppView,
  name: ViewElementName,
  text: string,
  className?: string,
): unknown {
  const created = element(view, name, className);
  view.setText(created, text);
  return created;
}

function appendDetail(
  view: MiniAppView,
  list: unknown,
  label: string,
  value: string,
): void {
  const row = element(view, "div", "profile-card__row");
  view.append(row, textElement(view, "dt", label, "profile-card__label"));
  view.append(row, textElement(view, "dd", value, "profile-card__value"));
  view.append(list, row);
}

function createNeutralAvatar(view: MiniAppView, hidden: boolean): unknown {
  const avatar = textElement(view, "span", en.avatarFallback, "profile-card__avatar-fallback");
  view.setAttribute(avatar, "role", "img");
  view.setAttribute(avatar, "aria-label", en.avatarUnavailable);
  view.setHidden(avatar, hidden);
  return avatar;
}

export function renderFallback(view: MiniAppView): void {
  renderStatus(view, en.noTelegram);
}

export function renderStatus(view: MiniAppView, message: string): void {
  view.clear();
  const paragraph = textElement(
    view,
    "p",
    message,
    "telegram-fallback",
  );
  view.appendToRoot(paragraph);
}

export function renderProfile(view: MiniAppView, user: UserInfo): void {
  view.clear();

  const card = element(view, "article", "profile-card");
  view.setAttribute(card, "aria-labelledby", "profile-heading");

  const avatarArea = element(view, "div", "profile-card__avatar");
  const neutralAvatar = createNeutralAvatar(view, user.photoUrl !== null);
  view.append(avatarArea, neutralAvatar);

  if (user.photoUrl !== null) {
    const image = element(view, "img", "profile-card__image");
    view.setImageAlternative(image, en.avatarAlt);
    view.setImageReferrerPolicy(image, "no-referrer");
    view.onImageError(image, () => {
      view.setHidden(image, true);
      view.setHidden(neutralAvatar, false);
    });
    view.setImageSource(image, user.photoUrl);
    view.append(avatarArea, image);
  }

  view.append(card, avatarArea);

  const heading = textElement(
    view,
    "h1",
    en.profileHeading,
    "profile-card__heading",
  );
  view.setAttribute(heading, "id", "profile-heading");
  view.append(card, heading);

  const details = element(view, "dl", "profile-card__details");
  appendDetail(view, details, en.userId, String(user.id));
  appendDetail(
    view,
    details,
    en.username,
    user.username ?? en.missingValue,
  );
  view.append(card, details);
  view.appendToRoot(card);
}

function asElement(value: unknown): Element {
  if (!(value instanceof Element)) {
    throw new TypeError("The browser view can only operate on DOM elements");
  }
  return value;
}

function asHtmlElement(value: unknown): HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new TypeError("The browser view can only operate on HTML elements");
  }
  return value;
}

function asImage(value: unknown): HTMLImageElement {
  if (!(value instanceof HTMLImageElement)) {
    throw new TypeError("The browser view can only operate on image elements");
  }
  return value;
}

export function createBrowserView(root: HTMLElement): MiniAppView {
  return {
    clear() {
      root.replaceChildren();
    },
    createElement(name) {
      return document.createElement(name);
    },
    addClass(value, className) {
      asElement(value).classList.add(className);
    },
    setText(value, text) {
      asElement(value).textContent = text;
    },
    setAttribute(value, name, attributeValue) {
      asElement(value).setAttribute(name, attributeValue);
    },
    setHidden(value, hidden) {
      asHtmlElement(value).hidden = hidden;
    },
    setImageAlternative(value, alternative) {
      asImage(value).alt = alternative;
    },
    setImageReferrerPolicy(value, policy) {
      asImage(value).referrerPolicy = policy;
    },
    setImageSource(value, source) {
      asImage(value).src = source;
    },
    onImageError(value, handler) {
      asImage(value).addEventListener("error", handler, { once: true });
    },
    append(parent, child) {
      asElement(parent).append(asElement(child));
    },
    appendToRoot(value) {
      root.append(asElement(value));
    },
  };
}
