import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import '../ink-calligraphy.css';

/*
 * Allura outline subset, from the official Google Fonts distribution:
 * https://github.com/google/fonts/tree/main/ofl/allura
 * Vector outlines preserve the real calligraphy without a font-loading flash.
 * The masks trace the calligraphic curves, rather than a rectangular wipe.
 *
Copyright 2010 The Allura Project Authors (https://github.com/googlefonts/allura)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

*/
type Glyph = { width: number; path: string };
const letters: Record<string, Glyph> = {
  ",": {
    "width": 178,
    "path": "M45 119Q42 121 39 121Q35 121 34.5 117.5Q34 114 34 113Q34 112 40.5 103.5Q47 95 56 85Q70 68 82.0 49.5Q94 31 101 9Q105 0 105 -8Q105 -18 100.5 -22.5Q96 -27 96 -35Q96 -41 97 -44Q100 -53 110.5 -53.0Q121 -53 125 -53Q137 -53 144.0 -41.5Q151 -30 151 -21Q151 -11 138.0 9.0Q125 29 106.5 52.0Q88 75 71.0 94.0Q54 113 45 119Z"
  },
  "a": {
    "width": 453,
    "path": "M319 10Q302 10 287.5 2.0Q273 -6 266 -28Q263 -37 263 -53Q263 -75 269.0 -102.0Q275 -129 282 -148Q277 -146 263.5 -130.5Q250 -115 230.5 -93.5Q211 -72 187.5 -50.5Q164 -29 139.0 -15.0Q114 -1 90 -1Q74 -1 56.0 -10.5Q38 -20 27 -35Q12 -55 12 -76Q12 -103 30.5 -132.0Q49 -161 78.5 -188.5Q108 -216 141.5 -238.5Q175 -261 205.5 -276.5Q236 -292 255 -297Q275 -303 300 -303Q314 -303 329.0 -299.5Q344 -296 354 -288Q362 -284 367.0 -277.0Q372 -270 372 -262Q372 -254 365 -257Q357 -269 343.5 -272.5Q330 -276 316 -276Q276 -276 228.0 -250.0Q180 -224 142 -189Q130 -179 109.5 -154.5Q89 -130 72.0 -101.0Q55 -72 55 -48Q55 -35 62 -25Q66 -18 75 -18Q89 -18 112.5 -33.0Q136 -48 161.0 -69.5Q186 -91 206.5 -111.0Q227 -131 236 -140Q241 -145 255.5 -160.5Q270 -176 287.0 -194.0Q304 -212 317.5 -225.0Q331 -238 335 -238Q340 -238 351.5 -235.5Q363 -233 371.0 -228.0Q379 -223 374 -215Q348 -177 332.5 -135.5Q317 -94 314 -70Q313 -66 313.0 -62.5Q313 -59 313 -55Q313 -15 341 -15Q356 -15 381.0 -33.0Q406 -51 432.0 -76.0Q458 -101 479.5 -124.5Q501 -148 509 -160Q512 -163 515 -163Q519 -163 522.0 -159.5Q525 -156 522 -151Q511 -133 490.0 -108.0Q469 -83 443.0 -58.0Q417 -33 392 -15Q379 -5 359.0 2.5Q339 10 319 10Z"
  },
  "b": {
    "width": 382,
    "path": "M80 28Q70 28 56.5 26.0Q43 24 33.0 21.0Q23 18 23 16Q23 14 32.5 12.5Q42 11 66 11Q91 11 120.5 -1.5Q150 -14 177.0 -31.0Q204 -48 223 -61Q253 -83 285.0 -117.5Q317 -152 330 -193Q332 -200 335.0 -212.0Q338 -224 338 -236Q338 -247 334.0 -254.5Q330 -262 319 -262Q299 -262 277.5 -251.0Q256 -240 236.5 -225.5Q217 -211 203 -198Q191 -189 174.0 -171.0Q157 -153 140.5 -131.0Q124 -109 114.0 -87.5Q104 -66 107 -49Q109 -45 104.5 -33.0Q100 -21 89 -21Q80 -21 68 -38Q61 -46 61 -71Q61 -94 66.0 -121.0Q71 -148 75 -165Q65 -153 57.5 -139.5Q50 -126 27 -100Q23 -96 18 -96Q11 -96 11 -104Q11 -110 15 -114Q51 -160 75.5 -192.5Q100 -225 106 -239Q114 -260 127.5 -293.0Q141 -326 158.0 -363.5Q175 -401 193.0 -436.5Q211 -472 228 -498Q243 -521 263.0 -544.5Q283 -568 308.0 -583.5Q333 -599 362 -599Q373 -599 386 -596Q387 -596 391 -594L401 -591Q403 -590 404.0 -590.0Q405 -590 406 -589Q434 -572 434 -542Q434 -518 418 -488Q404 -460 372.5 -423.5Q341 -387 300.5 -349.5Q260 -312 217.5 -277.5Q175 -243 140 -219Q130 -200 122.0 -175.0Q114 -150 109 -125Q129 -154 154.0 -181.5Q179 -209 198 -225Q229 -251 258.5 -266.5Q288 -282 313 -282Q325 -282 342.5 -274.0Q360 -266 374.5 -253.5Q389 -241 391 -227Q391 -224 391.5 -221.5Q392 -219 392 -216Q392 -189 377.0 -161.0Q362 -133 339.5 -108.0Q317 -83 292.5 -63.0Q268 -43 249 -30Q211 -5 168.5 11.5Q126 28 80 28ZM151 -259Q197 -289 243.0 -330.0Q289 -371 328.5 -416.0Q368 -461 392 -500Q407 -524 407 -547Q407 -558 402.5 -565.5Q398 -573 388 -573Q381 -573 371.5 -569.0Q362 -565 351 -555Q309 -523 273.0 -475.0Q237 -427 207.0 -371.5Q177 -316 151 -259Z"
  },
  "d": {
    "width": 374,
    "path": "M308 109Q282 105 271.0 84.0Q260 63 260 32Q260 -5 270.5 -48.0Q281 -91 295.0 -129.0Q309 -167 317 -187Q294 -160 264.5 -128.0Q235 -96 203.0 -67.0Q171 -38 141.5 -19.5Q112 -1 90 -1Q74 -1 56.0 -10.5Q38 -20 27 -35Q12 -55 12 -76Q12 -103 30.5 -132.0Q49 -161 78.5 -188.5Q108 -216 141.5 -238.5Q175 -261 205.5 -276.5Q236 -292 255 -297Q265 -299 276.0 -301.0Q287 -303 299 -303Q314 -303 329.0 -299.5Q344 -296 354 -288L358 -285Q382 -340 411.0 -396.5Q440 -453 473.0 -500.0Q506 -547 543.0 -575.5Q580 -604 620 -604Q625 -604 630.0 -603.5Q635 -603 639 -602Q664 -597 674.5 -584.5Q685 -572 685 -555Q685 -543 680.5 -529.5Q676 -516 668 -503Q646 -464 610.5 -426.0Q575 -388 533.0 -352.5Q491 -317 449.5 -284.0Q408 -251 374 -222Q359 -187 344.0 -140.0Q329 -93 319 -60Q313 -36 309.5 -15.0Q306 6 306 24Q306 57 318 78Q328 94 343 94Q354 94 363 86Q367 84 370.5 81.0Q374 78 379 75Q385 72 389 72Q396 72 390 83Q387 86 383.0 90.5Q379 95 374 100Q367 105 353.0 108.0Q339 111 325 111Q321 111 316.5 110.5Q312 110 308 109ZM404 -279Q444 -306 491.0 -346.5Q538 -387 579.0 -433.5Q620 -480 642 -522Q655 -546 655 -560Q655 -577 640 -577Q626 -577 603 -561Q536 -509 490.0 -437.5Q444 -366 404 -279ZM62 -25Q67 -19 75 -19Q90 -19 110.5 -32.0Q131 -45 138 -52Q189 -93 240.5 -140.5Q292 -188 337 -236Q341 -245 344.0 -253.5Q347 -262 351 -270Q336 -276 316 -276Q276 -276 228.0 -250.0Q180 -224 142 -189Q130 -179 109.5 -154.5Q89 -130 72.0 -101.0Q55 -72 55 -48Q55 -35 62 -25Z"
  },
  "e": {
    "width": 319,
    "path": "M131 15Q86 15 53.0 -6.0Q20 -27 20 -70Q20 -93 34 -126Q44 -149 71.0 -179.0Q98 -209 134.0 -237.5Q170 -266 207.0 -284.5Q244 -303 274 -303Q285 -303 294 -300Q311 -294 317.5 -281.0Q324 -268 324 -254Q324 -241 320.0 -229.0Q316 -217 310 -208Q292 -181 258.5 -160.0Q225 -139 190.5 -127.0Q156 -115 134 -113H132Q119 -113 119 -121Q119 -126 127 -126Q151 -128 187.5 -148.5Q224 -169 252 -191Q264 -201 280.5 -219.0Q297 -237 297 -254Q297 -272 280 -272Q271 -272 261.5 -268.0Q252 -264 246 -262Q217 -248 182.0 -218.5Q147 -189 118.5 -152.5Q90 -116 79 -79Q76 -71 75.0 -63.5Q74 -56 74 -49Q74 -25 89.5 -15.0Q105 -5 127 -5Q160 -5 195.0 -19.5Q230 -34 263.0 -57.0Q296 -80 323.5 -106.5Q351 -133 370 -158Q373 -162 377.0 -162.5Q381 -163 382 -161Q386 -160 386.0 -155.5Q386 -151 384 -147Q356 -108 316.5 -71.0Q277 -34 229.5 -9.5Q182 15 131 15Z"
  },
  "g": {
    "width": 415,
    "path": "M-2 367Q-14 364 -23 361Q-42 351 -50.0 338.5Q-58 326 -58 312Q-58 289 -42.5 262.5Q-27 236 -2 208Q23 178 61.5 147.0Q100 116 142.0 87.5Q184 59 216 38Q251 -33 278.0 -96.5Q305 -160 316 -194Q295 -171 271.0 -142.5Q247 -114 236 -101Q217 -81 193.0 -57.5Q169 -34 142.5 -17.5Q116 -1 91 -1Q75 -1 57.0 -10.5Q39 -20 28 -35Q13 -55 13 -76Q13 -103 31.5 -132.0Q50 -161 79.5 -188.5Q109 -216 142.5 -238.5Q176 -261 206.5 -276.5Q237 -292 256 -297Q274 -303 300 -303Q312 -303 329.0 -299.0Q346 -295 359.5 -286.5Q373 -278 373 -262Q373 -254 365 -257Q358 -269 344.5 -272.5Q331 -276 317 -276Q278 -276 229.5 -250.0Q181 -224 143 -189Q131 -179 110.0 -154.5Q89 -130 72.5 -101.0Q56 -72 56 -48Q56 -35 63 -25Q66 -20 75 -20Q94 -20 121.5 -37.0Q149 -54 180.0 -80.0Q211 -106 240.5 -135.5Q270 -165 293.0 -190.0Q316 -215 327 -228Q329 -233 334.0 -235.0Q339 -237 345 -237Q361 -237 378.5 -228.5Q396 -220 393 -214Q374 -173 348.5 -119.0Q323 -65 295 -6Q308 -13 338.0 -37.0Q368 -61 404.0 -94.5Q440 -128 471 -164Q483 -177 489 -177Q495 -177 492.0 -166.5Q489 -156 476 -140Q460 -121 432.0 -94.5Q404 -68 373.0 -40.5Q342 -13 315.5 8.5Q289 30 274 38Q243 104 214.0 162.5Q185 221 161 257Q145 282 122.0 308.0Q99 334 72.0 351.5Q45 369 15 369Q11 369 7.0 368.5Q3 368 -2 367ZM-12 341Q-6 345 5.5 341.0Q17 337 35 323Q74 292 102.0 250.5Q130 209 153.0 163.5Q176 118 197 76Q158 105 109.0 144.5Q60 184 20 223Q0 243 -13.5 267.5Q-27 292 -27 312Q-27 333 -12 341Z"
  },
  "h": {
    "width": 455,
    "path": "M48 13Q40 13 44 6Q46 0 54.5 -24.0Q63 -48 75.0 -82.0Q87 -116 100.0 -151.5Q113 -187 124 -215Q117 -206 102.5 -189.0Q88 -172 72.0 -153.0Q56 -134 42 -120Q39 -117 38 -117Q35 -117 35 -123Q35 -135 41 -145Q63 -173 83.5 -197.5Q104 -222 121 -244Q111 -250 111 -259Q111 -273 125 -273Q131 -273 134 -271Q135 -270 136.0 -270.0Q137 -270 138 -268Q143 -275 146.5 -281.0Q150 -287 153 -294Q157 -303 169.5 -328.5Q182 -354 201.0 -389.0Q220 -424 244.5 -461.5Q269 -499 297.5 -531.5Q326 -564 356.5 -584.0Q387 -604 419 -604Q423 -604 427.0 -603.5Q431 -603 435 -602Q460 -597 470.0 -584.5Q480 -572 480 -555Q480 -543 475.5 -529.5Q471 -516 463 -503Q443 -468 410.0 -432.5Q377 -397 336.5 -362.5Q296 -328 255.5 -295.5Q215 -263 180 -234Q156 -183 143.0 -143.5Q130 -104 123 -80Q134 -94 156.0 -120.0Q178 -146 206.0 -176.0Q234 -206 264.0 -233.5Q294 -261 321.0 -278.5Q348 -296 367 -296Q391 -296 391 -271Q391 -247 374.0 -218.0Q357 -189 346 -169Q332 -140 323.5 -113.5Q315 -87 313 -70Q312 -66 312.0 -62.5Q312 -59 312 -55Q312 -15 340 -15Q355 -15 380.0 -33.0Q405 -51 431.0 -76.0Q457 -101 478.5 -124.5Q500 -148 508 -160Q511 -163 515 -163Q519 -163 521.0 -160.0Q523 -157 521 -152Q511 -135 490.0 -109.5Q469 -84 443.0 -58.5Q417 -33 392 -15Q379 -5 358.5 2.5Q338 10 318 10Q302 10 287.0 2.0Q272 -6 265 -28Q262 -37 262 -53Q262 -58 262.0 -63.5Q262 -69 263 -75Q267 -107 284.5 -142.5Q302 -178 317 -206Q321 -214 323.5 -220.0Q326 -226 326 -230Q326 -238 319 -238Q312 -238 297.0 -229.0Q282 -220 257 -198Q235 -179 210.5 -148.5Q186 -118 162.5 -86.0Q139 -54 121.5 -31.0Q104 -8 97 -4Q92 -1 74.0 6.0Q56 13 48 13ZM199 -279Q239 -306 286.0 -346.5Q333 -387 374.5 -433.5Q416 -480 438 -522Q450 -545 450 -560Q450 -577 435 -577Q428 -577 419.0 -573.5Q410 -570 398 -561Q331 -509 285.0 -437.5Q239 -366 199 -279Z"
  },
  "i": {
    "width": 226,
    "path": "M198 -348Q185 -348 171.0 -350.5Q157 -353 157 -369Q157 -372 170.5 -383.0Q184 -394 198.5 -405.5Q213 -417 216 -419Q233 -433 237 -433Q242 -433 237.0 -420.0Q232 -407 232 -397Q232 -392 226.0 -380.0Q220 -368 212.0 -358.0Q204 -348 198 -348ZM89 10Q71 10 56.5 2.0Q42 -6 35 -28Q34 -31 33.5 -34.0Q33 -37 33 -41Q33 -61 42.0 -91.0Q51 -121 64 -149Q58 -141 50.0 -129.5Q42 -118 27 -100Q23 -96 18 -96Q11 -96 11 -104Q11 -110 15 -114Q41 -147 61.5 -173.0Q82 -199 92 -217Q92 -218 91.5 -218.5Q91 -219 91 -220Q91 -223 94 -229Q102 -253 110.5 -269.5Q119 -286 129 -288Q131 -288 133.0 -288.5Q135 -289 137 -289Q148 -289 157.0 -284.0Q166 -279 166 -269Q166 -260 159.5 -247.0Q153 -234 143 -215Q121 -169 103.5 -131.5Q86 -94 84 -70Q83 -66 83.0 -62.5Q83 -59 83 -55Q83 -15 109 -15Q125 -15 150.0 -32.5Q175 -50 201.0 -75.5Q227 -101 248.5 -124.5Q270 -148 278 -160Q281 -163 284 -163Q288 -163 290.5 -160.0Q293 -157 291 -152Q282 -135 260.5 -109.5Q239 -84 212.5 -58.5Q186 -33 161 -15Q148 -5 128.5 2.5Q109 10 89 10Z"
  },
  "n": {
    "width": 404,
    "path": "M-2 13Q-9 13 -6 6Q-3 0 5.0 -21.5Q13 -43 23.5 -73.0Q34 -103 45.0 -135.0Q56 -167 65.5 -195.0Q75 -223 81 -239Q83 -245 85.0 -256.5Q87 -268 93.5 -277.5Q100 -287 116 -287Q146 -287 146 -273Q146 -268 141 -256Q129 -229 115.0 -194.0Q101 -159 90.0 -128.0Q79 -97 73 -80Q83 -94 105.5 -120.0Q128 -146 156.0 -176.0Q184 -206 214.5 -234.0Q245 -262 271.5 -279.5Q298 -297 317 -297Q341 -297 341 -271Q341 -262 336 -244Q327 -219 313.0 -195.5Q299 -172 288 -146Q269 -99 266 -70Q265 -66 265.0 -62.5Q265 -59 265 -55Q265 -15 292 -15Q307 -15 332.0 -33.0Q357 -51 383.5 -76.0Q410 -101 431.0 -124.5Q452 -148 460 -160Q463 -163 466 -163Q470 -163 472.5 -160.0Q475 -157 473 -152Q464 -135 442.5 -109.5Q421 -84 395.0 -58.5Q369 -33 344 -15Q329 -5 307.0 3.0Q285 11 263 10Q235 7 223.0 -9.5Q211 -26 211 -49Q211 -76 221.5 -106.5Q232 -137 245.0 -164.0Q258 -191 266 -205Q274 -221 274 -230Q274 -238 267 -238Q260 -238 246.0 -229.0Q232 -220 208 -198Q186 -179 161.0 -148.5Q136 -118 112.5 -86.0Q89 -54 71.5 -31.0Q54 -8 47 -4Q42 -1 24.5 6.0Q7 13 -2 13Z"
  },
  "o": {
    "width": 347,
    "path": "M118 11Q90 11 69 -2Q34 -23 34 -78Q34 -101 42 -131Q49 -156 67.0 -185.5Q85 -215 109.5 -242.0Q134 -269 163.0 -286.0Q192 -303 221 -303Q233 -303 242 -300Q254 -296 262.5 -285.5Q271 -275 271 -259Q271 -242 262.5 -240.0Q254 -238 254 -244Q254 -246 254.5 -248.0Q255 -250 255 -251Q255 -259 250.5 -265.5Q246 -272 234 -272Q218 -272 194.5 -255.0Q171 -238 146.5 -209.5Q122 -181 103.5 -147.0Q85 -113 79 -79Q78 -74 77.5 -69.5Q77 -65 77 -60Q77 -37 87.5 -21.5Q98 -6 121 -6Q149 -6 175.0 -27.5Q201 -49 221.5 -79.0Q242 -109 252 -132Q260 -150 263.0 -163.0Q266 -176 266 -185Q266 -193 264.5 -199.0Q263 -205 261 -209Q259 -215 259 -218Q259 -226 265.5 -231.0Q272 -236 279 -236Q285 -236 292 -232Q300 -230 314.0 -229.0Q328 -228 344 -228Q361 -228 378.5 -229.0Q396 -230 409 -233Q411 -234 415 -234Q422 -234 422 -230Q422 -226 415 -223Q380 -207 352.5 -206.0Q325 -205 305 -205Q307 -180 294.0 -151.5Q281 -123 267 -101Q250 -76 228.0 -50.0Q206 -24 179.0 -6.5Q152 11 118 11Z"
  },
  "r": {
    "width": 314,
    "path": "M172 12Q155 12 142.0 4.5Q129 -3 124 -24Q121 -35 121 -46Q121 -76 136.5 -104.5Q152 -133 173.0 -157.5Q194 -182 209 -199Q217 -207 227.5 -220.0Q238 -233 238 -246Q238 -254 230.0 -261.5Q222 -269 201 -272Q189 -274 178.5 -275.5Q168 -277 157 -277Q129 -239 102.5 -200.5Q76 -162 46 -125Q39 -118 34 -118Q28 -118 28 -124Q28 -130 34 -136Q88 -202 127 -277Q122 -277 112.0 -277.5Q102 -278 96 -279Q89 -281 85.0 -285.0Q81 -289 81 -293Q81 -299 86 -300Q99 -304 114.0 -312.0Q129 -320 142 -333Q156 -347 168.0 -362.5Q180 -378 187 -386Q194 -391 202 -391Q207 -391 211.5 -388.0Q216 -385 216 -379Q216 -372 210 -361Q201 -347 190.5 -330.0Q180 -313 171 -299Q189 -298 207.0 -297.0Q225 -296 244 -296Q254 -296 263.5 -296.5Q273 -297 283 -297Q313 -297 313 -282Q313 -272 302.5 -257.5Q292 -243 277 -226Q243 -187 219.0 -144.0Q195 -101 187 -78Q179 -54 179 -42Q179 -18 198 -18Q215 -18 239.5 -35.0Q264 -52 290.0 -76.5Q316 -101 337.0 -124.5Q358 -148 367 -160Q369 -163 373 -163Q377 -163 380.0 -159.5Q383 -156 380 -151Q369 -134 348.0 -108.5Q327 -83 301.0 -58.0Q275 -33 250 -15Q237 -5 214.5 3.5Q192 12 172 12Z"
  },
  "s": {
    "width": 296,
    "path": "M51 50Q11 50 11 28Q11 12 28 -5Q41 -18 57.0 -26.0Q73 -34 77 -34Q82 -34 82.5 -30.0Q83 -26 78 -24Q68 -18 55.5 -7.5Q43 3 43 15Q43 31 62 31Q85 31 110.0 17.5Q135 4 156.5 -17.0Q178 -38 191.5 -59.5Q205 -81 205 -97Q205 -110 196.0 -121.0Q187 -132 159 -147Q140 -158 122.5 -170.0Q105 -182 96 -199Q88 -185 75.5 -165.5Q63 -146 46 -125Q40 -119 34 -119Q28 -119 28 -124Q28 -127 33 -134Q60 -166 73.0 -193.0Q86 -220 91 -234Q95 -263 118.0 -289.0Q141 -315 174.0 -334.5Q207 -354 241.5 -365.0Q276 -376 303 -376Q330 -376 351.0 -366.0Q372 -356 372 -334Q372 -322 365 -308Q356 -289 335 -274Q334 -273 332 -273Q324 -273 324 -280Q324 -285 329 -290Q337 -297 342.0 -307.0Q347 -317 347 -326Q347 -344 326 -344Q304 -344 268.5 -332.0Q233 -320 203 -301Q169 -279 146.0 -253.0Q123 -227 123 -207Q123 -197 129.5 -188.5Q136 -180 155 -169Q165 -163 183.0 -153.5Q201 -144 214 -136Q255 -111 255 -83Q255 -60 235.0 -36.5Q215 -13 183.5 6.5Q152 26 117.0 38.0Q82 50 51 50Z"
  },
  "t": {
    "width": 226,
    "path": "M89 10Q71 10 56.5 2.0Q42 -6 35 -28Q34 -31 33.5 -34.0Q33 -37 33 -41Q33 -61 42.0 -91.0Q51 -121 64 -149Q58 -141 50.0 -129.5Q42 -118 27 -100Q23 -96 18 -96Q11 -96 11 -104Q11 -110 15 -114Q41 -147 61.5 -173.0Q82 -199 92 -217Q92 -219 98.0 -229.5Q104 -240 114 -259Q106 -258 100.5 -257.5Q95 -257 91 -257Q84 -257 79.0 -263.0Q74 -269 78 -278Q83 -292 100.0 -294.0Q117 -296 130 -297Q131 -299 134 -299Q146 -321 157.0 -342.0Q168 -363 175.5 -377.0Q183 -391 183 -392Q203 -424 209.0 -434.5Q215 -445 225 -447Q236 -448 248.5 -446.0Q261 -444 265 -437Q268 -433 268 -427Q268 -418 264.0 -409.5Q260 -401 256 -396Q252 -389 245.5 -386.5Q239 -384 234 -374Q224 -355 212.0 -333.0Q200 -311 187 -291L199 -292Q223 -294 244.5 -297.0Q266 -300 294 -299Q299 -299 304.5 -297.5Q310 -296 310 -293Q310 -289 284 -282Q274 -278 240.5 -273.5Q207 -269 172 -265Q162 -246 154.0 -233.5Q146 -221 143 -215Q121 -169 103.5 -131.5Q86 -94 84 -70Q83 -66 83.0 -62.5Q83 -59 83 -55Q83 -15 109 -15Q125 -15 150.0 -32.5Q175 -50 201.0 -75.5Q227 -101 248.5 -124.5Q270 -148 278 -160Q281 -163 284 -163Q288 -163 290.5 -160.0Q293 -157 291 -152Q282 -135 260.5 -109.5Q239 -84 212.5 -58.5Q186 -33 161 -15Q148 -5 128.5 2.5Q109 10 89 10Z"
  },
  "v": {
    "width": 314,
    "path": "M72 32Q53 32 46.0 16.0Q39 0 40 -16Q45 -45 54.5 -75.5Q64 -106 73 -136Q75 -143 78.0 -154.0Q81 -165 84 -178Q77 -168 68.5 -156.0Q60 -144 51 -131Q47 -126 42 -126Q38 -126 36.0 -130.5Q34 -135 38 -140Q61 -172 74.0 -196.5Q87 -221 92 -236Q94 -256 87.5 -269.5Q81 -283 64 -283Q61 -283 58.0 -282.5Q55 -282 51 -281Q50 -281 49.5 -280.5Q49 -280 48 -280Q45 -280 45 -283Q45 -286 51 -294Q55 -297 66.0 -298.5Q77 -300 87.0 -301.0Q97 -302 99 -302Q113 -302 125.0 -300.0Q137 -298 145 -288Q150 -283 153.0 -275.0Q156 -267 154 -259Q154 -253 148.5 -238.5Q143 -224 136.5 -207.0Q130 -190 124.5 -176.5Q119 -163 118 -158Q108 -130 98.0 -96.0Q88 -62 90 -44Q137 -106 186.0 -168.0Q235 -230 292 -283Q315 -306 339.0 -325.5Q363 -345 393 -357Q406 -362 417 -362Q433 -362 445.0 -356.0Q457 -350 461 -342Q465 -339 465 -331Q465 -319 457 -319Q455 -319 449 -323Q444 -328 434.0 -328.0Q424 -328 415 -328Q394 -328 362.5 -307.0Q331 -286 294.5 -252.0Q258 -218 222.0 -178.0Q186 -138 155.5 -98.0Q125 -58 105.5 -26.0Q86 6 84 23Q84 28 79.0 30.0Q74 32 72 32Z"
  },
  "w": {
    "width": 549,
    "path": "M319 3Q300 3 284.0 -5.5Q268 -14 261 -35Q254 -58 254 -92Q254 -109 256.5 -126.5Q259 -144 263 -157Q258 -148 244.0 -123.5Q230 -99 209.0 -70.5Q188 -42 161.5 -21.5Q135 -1 104 -1Q64 -1 49.0 -21.5Q34 -42 34 -71Q34 -106 48.5 -143.5Q63 -181 78 -203Q85 -213 99.0 -233.0Q113 -253 126.5 -270.5Q140 -288 145 -290Q151 -292 158.0 -293.0Q165 -294 172 -294Q188 -294 198 -288Q208 -285 208 -278Q208 -275 203 -270Q192 -261 168.0 -234.0Q144 -207 120.5 -172.5Q97 -138 85 -104Q72 -72 72 -51Q72 -21 94 -21Q115 -21 154 -52Q182 -74 208.0 -107.0Q234 -140 256.5 -176.5Q279 -213 297 -244Q300 -251 314 -251Q331 -251 347.5 -243.5Q364 -236 357 -226Q328 -179 313 -125Q310 -113 306.5 -95.5Q303 -78 303 -61Q303 -43 309.0 -30.0Q315 -17 331 -17Q339 -17 347.5 -19.5Q356 -22 367 -29Q405 -49 441.5 -83.5Q478 -118 506.0 -160.5Q534 -203 543 -244Q546 -256 546 -273Q546 -293 539.5 -311.5Q533 -330 516 -337Q510 -339 503.0 -339.5Q496 -340 488 -339H486Q481 -339 481 -344Q481 -349 486 -351Q498 -354 517 -354Q535 -354 553.5 -348.0Q572 -342 579 -325Q587 -306 587 -287Q587 -250 565.5 -208.0Q544 -166 511 -127Q485 -95 453.0 -67.0Q421 -39 398 -23Q385 -13 363.5 -5.0Q342 3 319 3Z"
  },
  "y": {
    "width": 415,
    "path": "M-2 367Q-14 364 -23 361Q-42 351 -50.0 338.5Q-58 326 -58 312Q-58 289 -42.5 262.5Q-27 236 -2 208Q23 178 61.5 147.0Q100 116 142.0 87.5Q184 59 216 38Q233 3 251.5 -37.0Q270 -77 287.0 -114.5Q304 -152 316.5 -183.0Q329 -214 335 -231Q319 -212 298.0 -183.5Q277 -155 252.0 -123.5Q227 -92 200.5 -64.0Q174 -36 146.0 -18.5Q118 -1 91 -1Q51 -1 35.5 -21.5Q20 -42 20 -70Q20 -90 25.5 -110.0Q31 -130 40 -147Q46 -159 59.0 -179.0Q72 -199 89.0 -220.0Q106 -241 123.5 -255.0Q141 -269 157 -269Q176 -269 186.0 -255.5Q196 -242 188 -237Q172 -226 148.5 -203.5Q125 -181 102 -152Q96 -144 87.5 -127.0Q79 -110 72.0 -90.5Q65 -71 65 -55Q65 -48 67.0 -41.5Q69 -35 74 -32Q82 -26 92 -26Q106 -26 123.5 -35.0Q141 -44 157 -58Q213 -112 257.0 -171.0Q301 -230 350 -288Q353 -298 367 -298Q383 -298 400.5 -288.5Q418 -279 415 -273Q406 -253 391.5 -220.0Q377 -187 360.0 -149.0Q343 -111 326.0 -73.5Q309 -36 295 -6Q307 -12 338.0 -36.0Q369 -60 406.0 -94.5Q443 -129 473 -166Q479 -172 482 -172Q488 -172 488 -164Q488 -157 482 -148Q467 -128 440.5 -101.0Q414 -74 383.5 -46.5Q353 -19 324.0 3.5Q295 26 274 38Q243 104 214.0 162.5Q185 221 161 257Q145 282 122.0 308.0Q99 334 72.0 351.5Q45 369 15 369Q11 369 7.0 368.5Q3 368 -2 367ZM1 345Q9 345 20.5 340.0Q32 335 45 324Q83 293 109.0 251.5Q135 210 155.5 164.0Q176 118 197 76Q158 105 109.0 144.5Q60 184 20 223Q-4 247 -15.0 270.5Q-26 294 -26 312Q-26 345 1 345Z"
  }
};
const phrase = 'words, words and everything in between';
const lineText = ['words,', 'words and', 'everything', 'in between'];
let letterIndex = 0;
const inscription = lineText.map((text) => {
  let x = 0;
  const glyphs = Array.from(text).flatMap((character) => {
    if (character === ' ') { x += 200; return []; }
    const glyph = { ...letters[character], x, index: letterIndex++ };
    x += glyph.width;
    return [glyph];
  });
  return { glyphs, width: x };
});
const canvasWidth = Math.max(...inscription.map((line) => line.width)) + 260;
// A shared cycle keeps every letter together: write, readable hold, gentle fade.
export const INK_TIMING = {
  letterStep: 115,
  letterDuration: 460,
  draw: 240 + (letterIndex - 1) * 115 + 460,
  hold: 4000,
  fade: 650,
  reset: 250,
} as const;
const cycle = INK_TIMING.draw + INK_TIMING.hold + INK_TIMING.fade + INK_TIMING.reset;
type InkPhase = 'drawing' | 'hold' | 'reset' | 'static';

export function InkCalligraphy({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const artwork = useRef<SVGSVGElement>(null);
  const animations = useRef<Animation[]>([]);
  const id = useId().replace(/:/g, '');
  const inView = useInView(ref, { amount: 0.2 });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<InkPhase>('drawing');
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useLayoutEffect(() => {
    const svg = artwork.current;
    if (!svg || reducedMotion || typeof svg.animate !== 'function') {
      setPhase('static');
      return;
    }
    const finish = INK_TIMING.draw + INK_TIMING.hold;
    const invisible = finish + INK_TIMING.fade;
    const opacity = svg.animate([
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: finish / cycle },
      { opacity: 0, offset: invisible / cycle },
      { opacity: 0, offset: 1 },
    ], { duration: cycle, iterations: Infinity, easing: 'linear' });
    const strokes = Array.from(svg.querySelectorAll<SVGPathElement>('.ink-calligraphy-mask')).map((path, index) => {
      const start = (240 + index * INK_TIMING.letterStep) / cycle;
      const end = (240 + index * INK_TIMING.letterStep + INK_TIMING.letterDuration) / cycle;
      return path.animate([
        { strokeDashoffset: '1', offset: 0 },
        { strokeDashoffset: '1', offset: start },
        { strokeDashoffset: '0', offset: end },
        { strokeDashoffset: '0', offset: invisible / cycle },
        { strokeDashoffset: '1', offset: 1 },
      ], { duration: cycle, iterations: Infinity, easing: 'linear' });
    });
    animations.current = [opacity, ...strokes];
    animations.current.forEach((animation) => {
      animation.pause();
      animation.currentTime = 0;
    });
    return () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { setPhase('static'); return; }
    // Pause, rather than restart, so scrolling/CMS updates preserve the pen.
    animations.current.forEach((animation) => inView && pageVisible ? animation.play() : animation.pause());
    if (!inView || !pageVisible || !animations.current.length) return;
    const updatePhase = () => {
      const time = Number(animations.current[0]?.currentTime ?? 0) % cycle;
      setPhase(time < INK_TIMING.draw ? 'drawing' : time < INK_TIMING.draw + INK_TIMING.hold ? 'hold' : 'reset');
    };
    updatePhase();
    const timer = window.setInterval(updatePhase, 100);
    return () => window.clearInterval(timer);
  }, [inView, pageVisible, reducedMotion]);

  return <div ref={ref} className={`ink-calligraphy ${className}`}
    data-ink-phase={reducedMotion ? 'static' : phase}
    data-ink-playing={inView && pageVisible && !reducedMotion}
    data-ink-cycle-duration={cycle}>
    <span className="ink-calligraphy-readable">{phrase}</span>
    <svg ref={artwork} className="ink-calligraphy-lines" aria-hidden="true" focusable="false"
      viewBox={`-100 -730 ${canvasWidth + 220} 2950`}>
      {inscription.map((line, lineIndex) => <g
        key={lineIndex}
        className={`ink-calligraphy-line ink-calligraphy-line-${lineIndex + 1}`}
        transform={`translate(${canvasWidth - line.width - 130} ${lineIndex * 665})`}>
        {line.glyphs.map((glyph) => {
          const mask = `${id}-ink-${glyph.index}`;
          return <g key={glyph.index} transform={`translate(${glyph.x} 0)`}>
            <defs><mask id={mask} maskUnits="userSpaceOnUse" x="-200" y="-1000" width={glyph.width + 600} height="1500">
              <path className="ink-calligraphy-mask" d={glyph.path} pathLength="1"
                fill="none" stroke="white" strokeWidth="85" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="1" strokeDashoffset="0" />
            </mask></defs>
            <path d={glyph.path} mask={`url(#${mask})`} fill="currentColor" />
          </g>;
        })}
      </g>)}
    </svg>
  </div>;
}

export default InkCalligraphy;
