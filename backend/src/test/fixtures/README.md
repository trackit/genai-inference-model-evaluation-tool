Document conversion fixtures.

`sample.pdf` is a genuine PDF (built with ReportLab, not hand-assembled PDF
syntax) containing two paragraphs, used by the PDF parsing tests. PDF text is
extracted with `unpdf` (`extractText` with `mergePages: true`), a
serverless-friendly pure-JS build of pdfjs — chosen over `pdf-parse` because
that library pulled in a native `@napi-rs/canvas` dependency that breaks
esbuild ESM bundling in Lambda. Tests assert on this fixture with `toContain`
rather than an exact match to stay robust to minor whitespace/layout
differences in extracted text.

`sample.docx` is a minimal WordprocessingML document used by Mammoth parsing tests.

`sample.doc` is a genuine OLE Compound File (legacy binary Word 97-2003 format),
sourced from the `word-extractor` project's own MIT-licensed test fixtures
(https://github.com/morungos/node-word-extractor, `__tests__/data/test01.doc`).
Mammoth cannot parse this format at all, so `.doc` files are extracted with
`word-extractor` instead (see `DocumentConversionServiceS3.ts`); `.docx` files
continue to go through Mammoth.
