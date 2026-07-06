Document conversion fixtures.

`sample.docx` is a minimal WordprocessingML document used by Mammoth parsing tests.
`sample.doc` intentionally contains the same DOCX package bytes with a `.doc`
extension so tests can exercise the service's current `fileType = 'doc'` branch.

Mammoth does not parse legacy binary Word `.doc` files. If the product must support
true `.doc` uploads, the implementation should use a converter that handles that
format before passing content to Mammoth.
