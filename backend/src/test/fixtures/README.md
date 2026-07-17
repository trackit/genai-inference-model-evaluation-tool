Document conversion fixtures.

`sample.pdf` is a genuine PDF (built with ReportLab, not hand-assembled PDF
syntax) containing two paragraphs, used by `pdf-parse` parsing tests. Note:
`pdf-parse`'s `getText()` appends a `-- 1 of 1 --` page-separator line to the
extracted text, which `DocumentConversionServiceS3.ts` does not currently
strip — tests assert on this fixture with `toContain` rather than an exact
match to stay robust to that, but it's worth knowing this artifact ends up in
real extracted text for every PDF.

`sample.docx` is a minimal WordprocessingML document used by Mammoth parsing tests.

`sample.doc` is a genuine OLE Compound File (legacy binary Word 97-2003 format),
sourced from the `word-extractor` project's own MIT-licensed test fixtures
(https://github.com/morungos/node-word-extractor, `__tests__/data/test01.doc`).
Mammoth cannot parse this format at all, so `.doc` files are extracted with
`word-extractor` instead (see `DocumentConversionServiceS3.ts`); `.docx` files
continue to go through Mammoth.
