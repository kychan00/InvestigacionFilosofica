# Licensing

Investigación Filosófica uses a layered licensing model so that the project's
original software can be open source without pretending to relicense academic
content, datasets, images, or third-party software that the project does not own.

## Project software

Unless a more specific notice applies, the original software source code and
original project documentation in this repository are licensed under the
MIT License in [LICENSE](./LICENSE).

The package metadata also declares `MIT` as the software license.

## Material not relicensed under MIT

The root MIT License does **not** override or replace rights attached to
third-party material. In particular:

- `vendor/**` contains generated bundles that incorporate third-party
  packages. Those components remain under their upstream licenses. See
  [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and `LICENSES/**`.
- `data/**`, `src/data/**`, and `benchmark/**` may contain bibliographic
  metadata, abstracts, excerpts, evaluations, derived records, or other
  source-dependent material. They are not blanket-licensed under MIT.
- `assets/hero-school-athens.jpg` is a public-domain image asset, documented
  separately in [ASSETS.md](./ASSETS.md). It does not need the MIT License
  because its source file is already identified as free of known copyright
  restrictions.
- Content fetched from external services at runtime is not part of the
  project's MIT-licensed software merely because the interface displays it.
- Names, logos, trademarks, and institutional marks of third parties are not
  licensed by this repository.

## Important source-specific notes

### OpenAlex

OpenAlex data is released under CC0. OpenAlex-derived metadata can therefore
be reused very broadly, but this repository keeps its provenance explicit
instead of folding all datasets into the software license.

### Crossref

Crossref bibliographic metadata is generally reusable without restriction.
Abstracts are different: their copyright remains with the relevant publisher
or author. Any Crossref-derived abstract text must therefore retain the rights
that apply to that content.

### CUCSH journals

The local CUCSH corpus includes metadata and abstracts harvested from journals
such as Protrepsis and Quadripartita Ratio. Those texts are not relicensed by
the project's MIT License.

Protrepsis articles may carry Creative Commons licenses such as
CC BY-NC-SA 4.0. Quadripartita Ratio states that authors retain their
intellectual-property rights and permits redistribution of published content
subject to its own conditions, including attribution and no modification.
Those terms are more specific than the MIT License and remain controlling for
the journal content.

### Public-domain image assets

`assets/hero-school-athens.jpg` is derived from Wikimedia Commons file
`La scuola di Atene.jpg`, a faithful photographic reproduction of Raphael's
*The School of Athens*. Wikimedia Commons identifies both the underlying
two-dimensional work and the faithful photographic reproduction as public
domain and applies the Public Domain Mark 1.0 to the file.

Source:
https://commons.wikimedia.org/wiki/File:La_scuola_di_Atene.jpg

See [ASSETS.md](./ASSETS.md) for the asset record.

### University theses and editorial catalogs

The UdeG and Universidad de Guanajuato indexes in this repository are
reference-oriented records. The project does not claim copyright over thesis
full text, book text, or other underlying works. Where the repository records
show `referenceOnly: true` and `pdfCopies: 0`, the project is indexing and
linking rather than relicensing the works themselves.

Universidad de Guanajuato states that depositing a thesis in its institutional
repository does not transfer the author's copyright.

## Contributions

Contributors should only submit material they have the right to contribute
under the license applicable to that path. New source code should normally be
contributed under MIT unless a pull request clearly states otherwise.

## Practical rule

When in doubt:

1. Treat project-authored software as MIT.
2. Treat third-party code according to its upstream license.
3. Treat academic text, abstracts, datasets, images, and repository records
   according to their source-specific rights and notices.
