## Demeure AI — Report Build
## Usage: make  (builds PDF)  |  make clean  (remove build artifacts)

PDF = report.pdf
TEX = report.tex
PDFLATEX = pdflatex

all: $(PDF)

$(PDF): $(TEX)
	$(PDFLATEX) -interaction=nonstopmode $(TEX)
	$(PDFLATEX) -interaction=nonstopmode $(TEX)

clean:
	rm -f *.aux *.log *.out *.toc *.fdb_latexmk *.fls *.synctex.gz

distclean: clean
	rm -f $(PDF)

.PHONY: all clean distclean
