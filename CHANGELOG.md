## 1.4.4

security:

* update packages

## 1.4.3

internal:

* rename CHANGES -> CHANGELOG for https://yarnpkg.com/ to display changes

## 1.4.2

security:

* update used packages

## 1.4.1

fix:

* proper closing sync generators returning rejected promise

## 1.4.0

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
