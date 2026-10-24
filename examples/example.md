# NEMADEO 2 — Das Dokument mit zwei Gesichtern

*Eine kleine Geschichte über Text, Mathematik und die Kunst, nichts zu verlieren.*

---

## I. Eine Stadt aus Neon

Stell dir einen Raum vor, dessen Wände aus dunklem Glas bestehen. Hinter dem Glas fließen Farben ineinander: Violett, Türkis, ein wenig unmögliches Pink. Davor liegt ein einzelnes Blatt Papier.

Auf dem Blatt steht ein Satz:

> Es darf nur eine Wahrheit geben. Alles andere ist Darstellung.

NEMADEO könnte versuchen, diesen Satz in zwei Dokumenten zu verwalten: eines aus Zeichen, eines aus hübschem HTML. Aber dann müsste es bei jeder Änderung entscheiden, welchem der beiden es glaubt.

Also gibt es nur **ein Dokument**. Die anderen Ansichten sind Fenster darauf.

- **Raw** zeigt, *wie* etwas geschrieben wurde.
- **Formatted** zeigt, *was* daraus wird.
- **Save** bewahrt die Zeichen, nicht das Fenster.

Das klingt einfach. Gute Architektur klingt oft einfach, **nachdem** man lange genug an der falschen gebaut hat.

## II. Zwei Ansichten, ein Satz

Du kannst diesen Absatz im formatierten Modus bearbeiten. Du kannst in den Raw-Modus wechseln und `**fett**`, *kursiv* oder `Code` schreiben. Was du nicht berührst, soll unverändert bleiben — einschließlich der Leerzeilen.

Ein Dokument ist kein Bild. Es ist auch kein DOM-Baum. Es ist eine Folge von Zeichen, aus der sich ein Bild erzeugen lässt:

\[
D = \operatorname{Render}(\operatorname{Parse}(S))
\]

Dabei ist \(S\) der Quelltext und \(D\) die Darstellung. Der Syntaxbaum ist eine **Landkarte**, nicht das Land.

Bearbeiten wir einen Bereich \([a,b)\), entsteht eine neue Quelle:

\[
S_{t+1} = S_t[0:a] + \Delta + S_t[b:]
\]

Nur dieser Bereich muss sich ändern. Aus dem neuen Quelltext entsteht anschließend die neue Ansicht.

### Ein winziges Stück Quellcode

```javascript
function replaceRange(source, start, end, replacement) {
    return source.slice(0, start)
        + replacement
        + source.slice(end);
}
```

Das ist **kein vollständiger Editor**. Aber es zeigt, in welcher Richtung die Verantwortung fließt: von der Quelle zur Darstellung, niemals umgekehrt.

## III. Mathematik ist auch Sprache

LaTeX wirkt zunächst wie eine andere Welt. Tatsächlich erzählt es dieselbe Geschichte wie Markdown: Ein Ausdruck beschreibt eine Struktur, und ein Renderer macht sie sichtbar.

Ein kurzer Ausdruck lässt sich mitten in einen Satz setzen, beispielsweise \(E = mc^2\) oder \(x_i^2\).

Ein Bruch braucht etwas mehr Platz:

\[
f(x) = \frac{x^2 + 2x + 1}{x + 1}
\]

Für \(x \neq -1\) lässt sich das vereinfachen zu:

\[
f(x) = x + 1
\]

Und manchmal braucht ein Gedanke eine Matrix:

\[
A = \begin{pmatrix}
1 & 1 \\
0 & 1
\end{pmatrix},
\qquad
A^n = \begin{pmatrix}
1 & n \\
0 & 1
\end{pmatrix}
\]

Oder eine Summe:

\[
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
\]

Die wichtige Frage ist nicht, ob das SVG hübsch aussieht. Die Frage lautet: **Kann ich den Zähler verändern, ohne den Rest des Dokuments neu zu erfinden?**

## IV. Die kleinen Versprechen

Große Programme scheitern erstaunlich oft an kleinen Dingen.

| Situation | Was NEMADEO versprechen soll |
| --- | --- |
| Ein Wort wird fett | Nur die gewünschte Region ändert sich |
| Eine Formel wird bearbeitet | Ihr LaTeX bleibt die Quelle |
| Die Ansicht wird gewechselt | Kein Zeichen geht verloren |
| Ein leerer Formelblock existiert | Er bleibt sichtbar und editierbar |
| Ein langes Dokument wird geöffnet | Das Neon bleibt brillant, die Eingabe flüssig |
| Eine Datei wird exportiert | Der Quelltext ist vollständig |

Und das gilt auch für Dinge, die gar nicht spektakulär aussehen:

1. Ein Leerzeichen am Zeilenanfang.
2. Zwei aufeinanderfolgende Leerzeilen.
3. Ein Codeblock mit Zeichen, die wie Markdown aussehen: `**kein Fett**`.
4. Eine Formel, auf die noch ein Absatz folgen soll.

Wer solche Kleinigkeiten respektiert, darf irgendwann von großen Funktionen sprechen.

## V. Platz für das, was noch fehlt

Hier folgt absichtlich ein leerer mathematischer Block. Er ist kein Fehler, sondern ein Ort für einen Gedanken, den es noch nicht gibt.

\[
\]

**Und hier muss man trotzdem ganz normal weiterschreiben können.**

Vielleicht lautet die wichtigste Gleichung dieses Projekts am Ende gar nicht besonders mathematisch:

\[
\text{Vertrauen} = \text{Ausdruck} + \text{Erhaltung}
\]

Ein Editor verdient Vertrauen nicht dadurch, dass er alles kann. Sondern dadurch, dass er **nichts verändert, was wir nicht ändern wollten**.

---

*Geschrieben für NEMADEO 2. Nicht als Testdatei verkleidet — sondern als eigenständiger Text, der zufällig ziemlich viele Dinge testet.*
