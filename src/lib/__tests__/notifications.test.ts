/**
 * P12 — Notifications non bloquantes et dialogues accessibles.
 * `alert()` gelait l'interface, n'était pas annoncé par un lecteur d'écran et ne
 * laissait aucune trace. Ces tests fixent le comportement du remplaçant.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  pushToast, dismissToast, expireToasts, getToasts, subscribeToasts,
  resetToasts, toneForMessage, toast, toastSuccess, MAX_TOASTS,
} from "../toast";
import { nextFocusIndex, shouldTrapKey, isEscapeKey, dialogLabel, FOCUSABLE_SELECTOR } from "../focusTrap";

beforeEach(() => resetToasts());

describe("Notifications — cycle de vie", () => {
  it("empile le plus récent en tête et notifie les abonnés", () => {
    const seen: number[] = [];
    const off = subscribeToasts(() => seen.push(getToasts().length));
    pushToast({ title: "Import terminé", tone: "success", now: 1 });
    pushToast({ title: "Écriture validée", tone: "success", now: 2 });
    expect(getToasts().map((t) => t.title)).toEqual(["Écriture validée", "Import terminé"]);
    expect(seen).toEqual([1, 2]);
    off();
  });

  it("se désabonne proprement", () => {
    let calls = 0;
    const off = subscribeToasts(() => calls++);
    off();
    pushToast({ title: "Après désabonnement", now: 1 });
    expect(calls).toBe(0);
  });

  it("fusionne un message identique répété au lieu d'empiler", () => {
    pushToast({ title: "Exercice clôturé", tone: "warning", now: 1 });
    pushToast({ title: "Exercice clôturé", tone: "warning", now: 2 });
    pushToast({ title: "Exercice clôturé", tone: "warning", now: 3 });
    const list = getToasts();
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(3);
    expect(list[0].createdAt).toBe(3); // le délai repart
  });

  it("ne confond pas deux messages différents", () => {
    pushToast({ title: "Exercice clôturé", now: 1 });
    pushToast({ title: "Exercice réouvert", now: 2 });
    expect(getToasts()).toHaveLength(2);
  });

  it("plafonne la pile pour ne pas masquer l'écran", () => {
    for (let i = 0; i < MAX_TOASTS + 3; i++) pushToast({ title: `Message ${i}`, now: i });
    expect(getToasts()).toHaveLength(MAX_TOASTS);
    expect(getToasts()[0].title).toBe(`Message ${MAX_TOASTS + 2}`);
  });

  it("ferme un message à la demande", () => {
    const t = pushToast({ title: "À fermer", now: 1 });
    dismissToast(t.id);
    expect(getToasts()).toHaveLength(0);
  });

  it("expire après la durée de vie, pas avant", () => {
    pushToast({ title: "Éphémère", durationMs: 1000, now: 0 });
    expect(expireToasts(999)).toBe(0);
    expect(getToasts()).toHaveLength(1);
    expect(expireToasts(1001)).toBe(1);
    expect(getToasts()).toHaveLength(0);
  });

  it("donne un texte de repli quand le message est absent", () => {
    const t = toast(undefined);
    expect(t.title).toBe("Action impossible");
    expect(t.tone).toBe("danger");
  });
});

describe("Notifications — ton déduit du message", () => {
  it("classe les refus en danger", () => {
    expect(toneForMessage("Importez d'abord la Balance N.")).toBe("danger");
    expect(toneForMessage("Aucune société sélectionnée.")).toBe("danger");
    expect(toneForMessage("Montant invalide.")).toBe("danger");
  });

  it("classe les confirmations en succès", () => {
    expect(toneForMessage("Déclaration TVA générée.")).toBe("success");
    expect(toneForMessage("Écriture enregistrée.")).toBe("success");
    expect(toneForMessage("FEC exporté.")).toBe("success");
  });

  it("signale les points à vérifier en avertissement", () => {
    expect(toneForMessage("Écart de 2 000 FCFA à vérifier.")).toBe("warning");
    expect(toneForMessage("Doublon détecté sur la pièce ACH-0104-C.")).toBe("warning");
  });

  it("laisse le reste en information, et respecte un ton imposé", () => {
    expect(toneForMessage("Bienvenue dans l'espace de travail.")).toBe("info");
    expect(toastSuccess("Export terminé").tone).toBe("success");
    expect(pushToast({ title: "Importez la balance", tone: "info" }).tone).toBe("info");
  });
});

describe("Dialogues — piège de focus", () => {
  it("fait tourner le focus dans les deux sens", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0); // dernier → premier
    expect(nextFocusIndex(3, 0, true)).toBe(2); // premier → dernier
    expect(nextFocusIndex(3, 1, true)).toBe(0);
  });

  it("entre dans le dialogue quand le focus est encore dehors", () => {
    expect(nextFocusIndex(4, -1, false)).toBe(0);
    expect(nextFocusIndex(4, -1, true)).toBe(3);
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
  });

  it("n'intercepte Tab que s'il y a plusieurs éléments", () => {
    expect(shouldTrapKey(3, "Tab")).toBe(true);
    expect(shouldTrapKey(1, "Tab")).toBe(false);
    expect(shouldTrapKey(3, "Enter")).toBe(false);
  });

  it("reconnaît Échap", () => {
    expect(isEscapeKey("Escape")).toBe(true);
    expect(isEscapeKey("Esc")).toBe(true);
    expect(isEscapeKey("Enter")).toBe(false);
  });

  it("donne un nom au dialogue même sans titre", () => {
    expect(dialogLabel("Nouvelle écriture")).toBe("Nouvelle écriture");
    expect(dialogLabel("   ")).toBe("Dialogue");
    expect(dialogLabel(undefined)).toBe("Dialogue");
  });

  it("cible les éléments réellement atteignables au clavier", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("input:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("[tabindex]:not([tabindex='-1'])");
  });
});
