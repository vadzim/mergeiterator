enhancement:

* added performance test
* the code has been rewritten, performance increased by ~ 40%

changes:

* remove return generator value support

## 1.3.1

fix:

* change ts return type to AsyncGenerator

## 1.3.0

enhancement:

* added typescript typings

* accept promise of iterable as a root sequence

fix:

* fixed leak of closing iterables when root sequence contains not an iterable
