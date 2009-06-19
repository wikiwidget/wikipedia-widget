/*

Copyright _ 2005, Apple Computer, Inc.  All rights reserved.
NOTE:  Use of this source code is subject to the terms of the Software
License Agreement for Mac OS X, which accompanies the code.  Your use
of this source code signifies your agreement to such license terms and
conditions.  Except as expressly granted in the Software License Agreement
for Mac OS X, no other copyright, patent, or other intellectual property
license or right is granted, either expressly or by implication, by Apple.

*/ 


/*
 **********************************************************************
 *	<Fader object definition.  For fading a single element in or out> *
 **********************************************************************
 */
 
/*
 * Fader constructor.  Parameters:
 * -- element: The element to fade in or out
 * -- callback: A function that will be called when a fade is complete
 * -- fadeTime: How long (in ms) the fade should take.  See setFadeTime()
 */
function Fader (element, callback, fadeTime) {
	this.element = element;
	this.startTime = 0;
	this.timer = null;
	
	this.doneNotification = callback;
	
	// Initialize for a fade-in.  These values will be reset by the fadeIn/fadeOut functions
	this.fadingIn = false;
	this.now = 0.0;
	this.from = 0.0;
	this.to = 1.0;
	
	this.fadeOut = Fader_fadeOut;
	this.fadeIn = Fader_fadeIn;
	this.startFade = Fader_startFade;
	this.tick = Fader_tick;
	this.setFadeTime = Fader_setFadeTime;
	
	this.setFadeTime(fadeTime);
}

/* 
 * These "Fader_" methods should only be called through a Fader object/var.
 * Direct calls to these methods will result in undefined/null errors
 * because 'this' will evaluate to the parent window object.
 */
function Fader_fadeOut () {
	if (this.fadingIn) {
		this.startFade(this.now, 0.0);
		this.fadingIn = false;
	}
}

function Fader_fadeIn () {
	if (!this.fadingIn) {
		this.startFade(this.now, 1.0);
		this.fadingIn = true;
	}
}

function Fader_startFade (newFrom, newTo) {
	this.from = newFrom;
	this.to = newTo;
	
	this.startTime = (new Date).getTime() - 13; // set it back one frame

	if (this.timer != null) {
		clearInterval(this.timer);
		this.timer = null;
	}
	
	// Storing "this" in a local variable.  Necessary to call an object method in 
	// a setInterval timer.  We need to encapsulate the call to tick so it is
	// still correctly bound to this Fader object when the timer moves out 
	// of the scope of startFade().  If we didn't, "this" would evaluate to 
	// the window object when the call was finally made by the timer.
	var localThis = this;
	this.timer = setInterval (function() { localThis.tick() }, 13);
}

/*
 * Setter function for fade duration.  Floored at 250ms
 */
function Fader_setFadeTime (fadeTime) {
	this.fadeTime = fadeTime > 250 ? fadeTime : 250;
}

/*
 * tick does all the incremental work.  
 * Every time this is hit by the timer, we calculate and apply
 * a new opacity value on our target element.  Eventually,
 * this will hit 1 (on fade-in) or 0 (on fade-out).
 */
function Fader_tick() {	
	var T;
	var ease;
	var time = (new Date).getTime();
	
	// Calculate the time delta since the fade started.
	T = limit_3(time-this.startTime, 0, this.fadeTime);
	
	// The fade is over.  Clear out the timer, making this the last iteration.
	if (T >= this.fadeTime) {
		clearInterval (this.timer);
		this.timer = null;
		this.now = this.to;
		// invoke our callback, if one was set.
		if (this.doneNotification) {
			var localThis = this;
			setTimeout(function() { localThis.doneNotification(); }, 0);
		}
	} else {
		ease = 0.5 - (0.5 * Math.cos(Math.PI * T / this.fadeTime));
		this.now = computeNextFloat (this.from, this.to, ease);
	}
	
	// Set the opacity of the fading element.  Over repeated ticks,
	// this.now will go up (fade in) or down (fade out).
	this.element.style.opacity = this.now;
}
 
/*
 * support functions for tick operation
 */
function limit_3 (a, b, c) {
    return a < b ? b : (a > c ? c : a);
}

function computeNextFloat (from, to, ease) {
    return from + (to - from) * ease;
}


// End Fader object definition



/*
 **************************************************************************************
 *	<TransitionFader object definition.  Fades between 2 of x number of DOM elements> *
 **************************************************************************************
 */
 
/*
 * TransitionFader constructor.  Parameters:
 * -- elements: Should be an array.  Use Fader object to fade a single element in/out
 * -- fadeTime: How long (in ms) the fades should take.
 * -- inDelay: Pause (in ms) between transition fades.  See setFadeDelay()
 *
 * As with Fader, all the methods should be called through an instance, NOT 
 * directly.
 */
function TransitionFader (elements, fadeTime, inDelay) {
	this.start = TransitionFader_start;
	this.prepNextFade = TransitionFader_prepNextFade;
	this.fade = TransitionFader_fade;
	this.getFadeTime = TransitionFader_getFadeTime;
	this.setFadeTime = TransitionFader_setFadeTime;
	this.pause = TransitionFader_pause;
	this.resume = TransitionFader_resume;
	this.setFadeDelay = TransitionFader_setFadeDelay;

	// Create two fader objects: incoming and outgoing
	// We set prepNextFade as a callback for one of the faders, so we can cycle
	// through the elements array as a fade completes.
	var localThis = this;
	this.inFader = new Fader(elements[0], function() { localThis.prepNextFade(); }, fadeTime);
	this.outFader = new Fader(elements[0], null, fadeTime);
	
	// All the elements we wish to transition between.  
	// We do two at a time (one in / one out), but we can move through 
	// an array of any size (see prepNextFade()).
	this.elements = elements;
	this.currentIndex = 0;
	this.setFadeDelay(inDelay);
	
	this.paused = false;
	this.interrupted = false;
}

function TransitionFader_start() {
	this.inFader.fadeIn();
}

function TransitionFader_prepNextFade () {
	// Before swapping the faders, make sure the element on its way out
	// is completely gone.  We do this in case the in and out Faders get
	// too far out of sync (since this function is only tied to inFader).
	this.outFader.element.style.opacity = 0;
	
	// swap the faders around.  The element that was just faded in
	// will now be faded out.
	var temp = this.outFader;
	this.outFader = this.inFader;
	this.inFader = temp;
		
	// Select a new element to be faded in.
	this.currentIndex = (this.currentIndex + 1) % this.elements.length;
	this.inFader.element = this.elements[this.currentIndex];

	// Queue up the next transition, using the delay property
	var localThis = this;
	window.setTimeout(function() { localThis.fade(); }, this.delay);
}

/*
 * Do the fades.
 * We check the paused flag in case the delayed call from prepNextFade was
 * already in place before paused was set to true.
 * If so, we postpone the fade and set the interrupted flag (see resume())
 */
function TransitionFader_fade() {
	if (this.paused) {
		this.interrupted = true;
		return;
	}
	this.inFader.fadeIn();
	this.outFader.fadeOut();
	this.fading = true;
}

function TransitionFader_getFadeTime () {
	return this.inFader.fadeTime;
}

function TransitionFader_setFadeTime (newFadeTime) {
	this.inFader.setFadeTime(newFadeTime);
	this.outFader.setFadeTime(newFadeTime);
}

/*
 * Setter for the delay between fades.  Floored at 500ms
 */
function TransitionFader_setFadeDelay (inDelay) {
	this.delay = inDelay > 500 ? inDelay : 500;
}

/*
 *	Set the paused flag, so the transition timer stops the next time it is hit.
 */
function TransitionFader_pause () {
	this.paused = true;
}

/*
 * If we are in the middle of a fade, setting paused to false will allow
 * the timers to continue as usual.  iff a fade was postponed, we need to 
 * explicitly kick things off again.
 */
function TransitionFader_resume() {
	this.paused = false;
	if (this.interrupted) {
		this.interrupted = false;
		this.fade();
	}
}