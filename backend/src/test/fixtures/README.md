Document conversion fixtures.

`sample.docx` is a minimal WordprocessingML document used by Mammoth parsing tests.

`sample.doc` is a genuine OLE Compound File (legacy binary Word 97-2003 format),
sourced from the `word-extractor` project's own MIT-licensed test fixtures
(https://github.com/morungos/node-word-extractor, `__tests__/data/test01.doc`).
Mammoth cannot parse this format at all, so `.doc` files are extracted with
`word-extractor` instead (see `DocumentConversionServiceS3.ts`); `.docx` files
continue to go through Mammoth.