# Nemadeo (Neon Markdown Editor)

Nemadeo is a lightweight, zero-dependency web-based text editor that combines a distraction-free writing experience with a dynamic, glowing neon aesthetic. Write your texts in a beautiful WYSIWYG environment and export them seamlessly to clean Markdown.

## Features

* **Dynamic Neon UI:** Smooth, animated CSS gradients and glowing text effects that gently cycle through carefully selected neon color palettes.
* **WYSIWYG Editing:** Format your text directly in the browser (Bold, Italic, Headings, Lists, and Code Blocks) without writing Markdown syntax manually.
* **Instant Markdown Export:** One click converts your rich text into clean `.md` syntax and triggers a file download.
* **Auto-Save:** Never lose your progress. Nemadeo automatically saves your drafts locally in your browser.
* **Live Metrics:** Real-time word and character counts right at the bottom of your page.
* **Zero Dependencies:** Built purely with HTML, CSS, and Vanilla JavaScript. No build tools or package managers required.

## How to Use

Since Nemadeo is a single-file application, getting started is as easy as it gets:

1. Clone or download this repository.
2. Open the `index.html` file in any modern web browser.
3. Start typing!

## Technologies Used

* **HTML5:** For the structure and `contenteditable` editor capabilities.
* **CSS3:** Utilizing CSS variables, `@property` for smooth gradient animations, and advanced `text-shadow` / `filter` techniques for the neon glow.
* **Vanilla JavaScript:** Handling the WYSIWYG commands, local storage logic, DOM manipulation, and HTML-to-Markdown parsing.

## Issues
* Performance is really poor for larger documents. Be aware of that.

## License

This project is open-source and available under the [MIT License](LICENSE).