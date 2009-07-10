/*

File: Scroller.js

Abstract: JavaScript support code for a DHTML scrollbar.  It should not be 
	necessary to understand this code if the instructions in Scroller.html are
	followed.  The only things of interest for customization should be the 
	LINE_SCROLL_DIST (number of pixels each up/down arrow stroke scrolls)
	and PAGE_SKIP_PAUSE (time interval when holding the mouse down in the 
	scroll track, or holding the page/arrow keys) constants.
	
	To change the content currently controlled by the Scroller, pass the new 
	content div to calculateAndShowThumb (see ScrollerMain.js)

Version: 1.0

� Copyright 2005 Apple Computer, Inc. All rights reserved.

IMPORTANT:  This Apple software is supplied to 
you by Apple Computer, Inc. ("Apple") in 
consideration of your agreement to the following 
terms, and your use, installation, modification 
or redistribution of this Apple software 
constitutes acceptance of these terms.  If you do 
not agree with these terms, please do not use, 
install, modify or redistribute this Apple 
software.

In consideration of your agreement to abide by 
the following terms, and subject to these terms, 
Apple grants you a personal, non-exclusive 
license, under Apple's copyrights in this 
original Apple software (the "Apple Software"), 
to use, reproduce, modify and redistribute the 
Apple Software, with or without modifications, in 
source and/or binary forms; provided that if you 
redistribute the Apple Software in its entirety 
and without modifications, you must retain this 
notice and the following text and disclaimers in 
all such redistributions of the Apple Software. 
Neither the name, trademarks, service marks or 
logos of Apple Computer, Inc. may be used to 
endorse or promote products derived from the 
Apple Software without specific prior written 
permission from Apple.  Except as expressly 
stated in this notice, no other rights or 
licenses, express or implied, are granted by 
Apple herein, including but not limited to any 
patent rights that may be infringed by your 
derivative works or by other works in which the 
Apple Software may be incorporated.

The Apple Software is provided by Apple on an "AS 
IS" basis.  APPLE MAKES NO WARRANTIES, EXPRESS OR 
IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED 
WARRANTIES OF NON-INFRINGEMENT, MERCHANTABILITY 
AND FITNESS FOR A PARTICULAR PURPOSE, REGARDING 
THE APPLE SOFTWARE OR ITS USE AND OPERATION ALONE 
OR IN COMBINATION WITH YOUR PRODUCTS.

IN NO EVENT SHALL APPLE BE LIABLE FOR ANY 
SPECIAL, INDIRECT, INCIDENTAL OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, 
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS 
OF USE, DATA, OR PROFITS; OR BUSINESS 
INTERRUPTION) ARISING IN ANY WAY OUT OF THE USE, 
REPRODUCTION, MODIFICATION AND/OR DISTRIBUTION OF 
THE APPLE SOFTWARE, HOWEVER CAUSED AND WHETHER 
UNDER THEORY OF CONTRACT, TORT (INCLUDING 
NEGLIGENCE), STRICT LIABILITY OR OTHERWISE, EVEN 
IF APPLE HAS BEEN ADVISED OF THE POSSIBILITY OF 
SUCH DAMAGE.

*/


/*
 ********************************
 * Objects used by the Scroller	*
 ********************************
 */	
	var currentContent;			// currently-visible div; allows Scroller to control arbitrary content
	var scrollBar;				// Parent scrollbar div, contains the track and thumb
	var scrollThumb;			// Scroller's thumb control
	var scrollTrack;			// Scroller's base/track
	var scrollTimer;			// timer for track/key scrolling
    var scrollable;             // bug work-around

/*
 ************************************
 *  Dimensions used by the Scroller	*
 ************************************
 */
	var currentContentHeight;					// height of currently-visible content div
	var currentContentTop;						// top " " "
	var viewHeight;								// height of the parent (overflow:hidden) view
	var scrollBarHeight;						// " " " scrollbar	
	var thumbHeight;							// " " " thumb control
	var numberOfScrollablePixels;				// for calculating thumb size/position and content position ("page number")

	var trackMouseY					= 0;		// mouse location in the scroll track; used for click-scrolling
	var thumbStartY					= -1;		// exact point we started scrolling with the thumb
	var thumbStartTop				= -1;		// thumb's "top" value when we started scrolling
	
	var trackingMouse				= false;	// is the mouse down in the scroll track
	var trackingKeys				= false;	// is arrow/page up/down being held

/*
 ************************************************************
 * Style constants hardcoded to match respective CSS values	*
 ************************************************************
 */
	var SCROLLBAR_TOP			= -1;	// starting (topmost) position for scroll thumb
	var MIN_SCROLL_THUMB_HEIGHT	= 27;	// minimum size for acceptable appearance of the scroll thumb

/*
 ************************************************
 * Key/track scrolling constants				*
 * Customize these according to your content	*
 ************************************************
 */
	var LINE_SCROLL_DIST		= 40;	// line up/down travel; for arrow key scrolling
	var PAGE_SKIP_PAUSE			= 150;	// time (ms) between key/track scroll actions


// set up the scrollbar with elements for the scrollbar, track, thumb
// set scrollable content in calculateAndShowThumb
function scrollerInit (barDiv, trackDiv, thumbDiv) {
	scrollBar	= barDiv;
	scrollTrack = trackDiv;
	scrollThumb = thumbDiv;
	
	// keydown listener is in event bubble mode, so child elements of the
	// document can still listen to keys if they need to.
	document.addEventListener("keydown", keyPressed, false);
	// thumb/track listeners are capture-style, to prevent child elements from
	// also reacting to the mouse activity on the scroll track or thumb.
	scrollTrack.addEventListener("mousedown", mouseDownTrack, true);
	scrollThumb.addEventListener("mousedown", mouseDownThumb, true);
}

// Calculate the height of the views and make the thumb proportional.
// If a single scroller is being shared across multiple divs (as in this sample)
// this function must be called whenever the divs swap, to recalibrate the scrollbar
// Also must be called when changing the size of the parent div
function calculateAndShowThumb(contentDiv) {

	if (contentDiv != null) {
		currentContent = contentDiv;
	} else if (currentContent == null) {
		hideScrollbar();
	}
	
	currentContent.style.display = "block";
	var currentContentStyle = document.defaultView.getComputedStyle(currentContent,"");
	currentContentTop = parseInt(currentContentStyle.getPropertyValue("top"));
	if (isNaN(currentContentTop)) {
		currentContentTop = 0;
	}

	// Get the proportion of visible content in parent div to total content in child div
	// We'll use this to calculate the size of (and need for) the scroll thumb
	currentContentHeight = parseInt(currentContentStyle.getPropertyValue("height"));
	viewHeight = parseFloat (document.defaultView.getComputedStyle(currentContent.parentNode, "").getPropertyValue("height"));
	scrollBarHeight = parseInt(document.defaultView.getComputedStyle(scrollBar, "").getPropertyValue("height"));
	DEBUG("cast: viewHeight=" + viewHeight + " currentContentHeight=" + currentContentHeight + " top=" + currentContentTop + " scrollBarHeight=" + scrollBarHeight);
		
	var percent = getProportion (viewHeight, currentContentHeight);
	DEBUG("cast: percent=" + percent);
	
	// hide the scrollbar if all the content is showing.  Determined by the calculated scrollbar height and position.
	if (percent == 0) {
		hideScrollBar();
	} else {
		// Position the thumb according to where the content is currently scrolled.
		// This is necessary for sharing the same scrollbar between multiple content
		// panes that will likely be at different scroll positions.
		thumbHeight = Math.max(Math.round(scrollBarHeight * percent), MIN_SCROLL_THUMB_HEIGHT);
		
		numberOfScrollablePixels = scrollBarHeight - thumbHeight - SCROLLBAR_TOP;
		
		thumbTop = thumbPositionForPagePosition(currentContentTop);
		
		scrollThumb.style.height = thumbHeight + "px";
		scrollThumb.style.top = thumbTop;
		
		DEBUG("cast: new thumbheight=" + scrollThumb.style.height + " thumbTop=" + thumbTop);
		
		// This is a safeguard so the content matches the new thumb position.  Necessary for live-resizing to work.
		scrollContent(thumbTop);
		
		showScrollBar();
	}
}

function showScrollBar() {
	scrollTrack.style.display = "block";
	scrollThumb.style.display = "block";
    scrollable = true;
}

function hideScrollBar() {
	scrollTrack.style.display = "none";
	scrollThumb.style.display = "none";
	scrollable = false;
}

/* Mouse scrolling */

function mouseWheelMove(event) {
    if (scrollable) {
        var clicks = window.event.wheelDelta/10;
        scrollBy(clicks);
    }
}

/*
 ****************************
 *	Key Scrolling Functions	*
 ****************************
 */

function ascii(letter) {
	return letter.charCodeAt(0);
}

function keyPressed (event) {
	//when no text box is selected, event.target.id.length == 0
	var invalid = event.target.id.length;
	var theAction = null;
	switch (event.charCode) {
		case 63232: // up arrow
            if ((!invalid) && scrollable) {
                if (event.altKey) {
                    theAction = pageUp;
                } else {
                    theAction = lineUp;
                }
			}
			break;
		case 63233: // down arrow
            if ((!invalid) && scrollable) {
                if (event.altKey) {
                    theAction = pageDown;
                } else {
                    theAction = lineDown;
                }
			}
			break;
		// For home and end, scroll by the known size of the content;
		// this will likely put us out of bounds, but scrollBy will 
		// catch and correct that
		case 63273: // home
            if (scrollable) {
    			scrollBy(currentContentHeight);
                theAction = null;
			}
			break;
		case 63275:	// end
            if (scrollable) {
                scrollBy(-currentContentHeight);
                theAction = null;
			}
			break;
		case 63276: // pageup
            if (scrollable) {
                theAction = pageUp;
			}
			break;
        case 32: // spacebar
            if ((!invalid) && scrollable) {
                if (event.shiftKey) {
                    theAction = pageUp;
                } else {
                    theAction = pageDown;
                }
            }
            break;
		case 63277: // pagedn
            if (scrollable) {
                theAction = pageDown;
			}
			break;
        case 9: // tab
			if (event.target.id == "commentField") {
				theAction = selectNameField;
			}
            break;
        case 8: // delete
            if (!invalid) {
                if (event.shiftKey) {
                    theAction = goForwardInHistory;
                } else {
                    theAction = goBackInHistory;
                }
            }
            break;
		default:
			theAction = null;
			break;
	}
	if (event.metaKey) {
	   if (event.charCode == 117) { // u
	       copyProperURL();
	   } else if (event.charCode == 102) { // f
	       selectSearchInput();
	   }
    }
	if (event.ctrlKey) {
		// huh?  when ctrl is not down, 'o' charcode is 111
		// when ctrl is down, 'o' charcode is 15...
		// alert('ctrl + '+event.charCode);
		if (event.charCode == 15 || event.charCode == 111) {
			// ctrl-o
			goToLoginPage();
		}
	}
	if (theAction == null) {
		trackingKeys = false;
	} else {
		// Start listening for the key release
		document.addEventListener("keyup", keyReleased, false);
		event.stopPropagation();
		event.preventDefault();

		trackingKeys = true;
		theAction();
		// Start a timer with the new key action;
		// any new key action should replace/override the old
		setTimerKeyAction(theAction);
	}
	return true;
}

function keyReleased (event) {
	trackingKeys = false;
	scrollTimer.keyAction = null;

	document.removeEventListener("keyup", keyReleased, false);
	event.stopPropagation();
	event.preventDefault();
}


/*
 ********************************
 *	Thumb Scrolling Functions	*
 ********************************
 */

// mousedown is presumably the start of a thumb drag (scroll) action.
function mouseDownThumb (event) {
	// These listeners are only useful while there is mouse activity on the thumb.
	// Add them on mousedown; remove on mouseup.
	document.addEventListener("mousemove", mouseMoveScrollThumb, true);
	document.addEventListener("mouseup", mouseUpScrollThumb, true);
	
	thumbStartY = event.y;
	thumbStartTop = parseInt(document.defaultView.getComputedStyle(scrollThumb,"").getPropertyValue("top"));
	if (isNaN(thumbStartTop)) {
		thumbStartTop = -1;
	}
	DEBUG("mdt: ThumbHeight:" + thumbHeight + " thumbStartY=" + thumbStartY + " thumbStartTop=" + thumbStartTop);
}

// At this point the scrollThumb is being dragged;  We know this because the 
// mousemove listener is only installed after a mousedown
function mouseMoveScrollThumb (event) {
	var deltaY = event.y - thumbStartY;
	
	var newPosition = thumbStartTop + deltaY;
	DEBUG("mmst: event.y=" + event.y + " thumbStartY=" + thumbStartY + " thumbStart=" + thumbStartTop);
	scrollContent(newPosition);
}

function mouseUpScrollThumb (event) {
	// Remove listeners; they'll be re-added on the next mouseDown
	document.removeEventListener("mousemove", mouseMoveScrollThumb, true);
	document.removeEventListener("mouseup", mouseUpScrollThumb, true);
	
	// reset the starting position
	thumbStartY = -1;
}

/*
 ********************************
 *	Track Scrolling Functions	*
 ********************************
 */

// mousedown should reset the timer no matter what; even if already key-scrolling
function mouseDownTrack (event) {
	trackingMouse = true;
	updateTrackMouseY(event);
	
	scrollTrack.addEventListener("mousemove", mouseMoveTrack, true);
	scrollTrack.addEventListener("mouseover", mouseOverTrack, true);
	scrollTrack.addEventListener("mouseout", mouseOutTrack, true);
	document.addEventListener("mouseup", mouseUpTrack, true);
	
	// Determine if the click was above or below the thumb;
	// Set the repeat timer to the appropriate page action
	var thumbTop = document.defaultView.getComputedStyle(scrollThumb,"").getPropertyValue("top");
	var debugStr = ("mdt: mouseY=" + trackMouseY + " scrollThumbY=" + thumbTop + "; ");
		
	if (trackMouseY > parseInt(thumbTop)) {
			debugStr += "click BELOW thumb";
		pageDown();
		setTimerMouseAction(pageDown);
	} else {
			debugStr += "click ABOVE thumb";
		pageUp();
		setTimerMouseAction(pageUp);
	}
	
	debugStr += (": newPosition=" + trackMouseY);
	DEBUG(debugStr);
	
	event.stopPropagation();
	event.preventDefault();
}

function mouseMoveTrack(event) {
	// If the mouse moved while being held down, update the location
	// so track-scrolling stops in the right place
	updateTrackMouseY(event);
	event.stopPropagation();
	event.preventDefault();

}

function mouseOutTrack(event) {
	// turn track-scrolling off if the mouse moves out while pressed;
	// the timer keeps firing until the mouse is released
	trackingMouse = false;
	event.stopPropagation();
	event.preventDefault();
}

function mouseOverTrack(event) {
	// This will resume track-scrolling: timer is still firing, but
	// pageUp/pageDown are waiting for the mouse to return to the track
	updateTrackMouseY(event);
	trackingMouse = true;
	event.stopPropagation();
	event.preventDefault();
}

function mouseUpTrack(event) {
	// scrollTimer will stop track-scrolling when we set these two flags
	trackingMouse = false;
	scrollTimer.mouseAction = null;

	// After mouseup, these events are just noise. Remove them; they'll be re-added on the next mouseDown
	scrollTrack.removeEventListener("mousemove", mouseMoveTrack, true);
	scrollTrack.removeEventListener("mouseover", mouseOverTrack, true);
	scrollTrack.removeEventListener("mouseout", mouseOutTrack, true);
	document.removeEventListener("mouseup", mouseUpTrack, true);

	event.stopPropagation();
	event.preventDefault();
}

// correct the coordinates for the sourceEvent so they properly match the source component
// **YOU MAY NEED TO UPDATE THIS FUNCTION** depending on how deeply the scrollbar div is nested
function updateTrackMouseY (event) {
	DEBUG("utmY: source=" + event.toElement.id + " rawY=" + event.y + " offsetY=" + event.offsetY + " layerY=" + event.layerY + " offsetTop=" + event.toElement.offsetTop);
	trackMouseY = event.offsetY + event.toElement.offsetTop;
}




/*
 ********************
 * Scroll functions	* 
 ********************
 */ 

// Convenience "line" up/down functions; change LINE_SCROLL_DIST
// to increase/decrease interval
function lineDown () {
//	if (trackingKeys==true) {
		scrollBy(-LINE_SCROLL_DIST);
//	}
}

function lineUp () {
	if (trackingKeys==true) {
		scrollBy(LINE_SCROLL_DIST);
	}
}	

// Reposition the content one page (viewHeight) upwards; the content's top 
// becomes increasingly NEGATIVE (moves upwards) as we scroll down.	
function pageDown() {
	var thumbStyle = document.defaultView.getComputedStyle(scrollThumb,"");
	var currentThumbBottom = parseInt(thumbStyle.getPropertyValue("top")) + parseInt(thumbStyle.getPropertyValue("height"));
	// Check for key/track scrolling; prevent out-of-bounds values
	if ((trackingKeys==true) || (trackingMouse==true && trackMouseY>currentThumbBottom)) {
		scrollBy(-viewHeight + 8);
	}
}

// very similar to pageDown, with some values negated to move the content in a different direction.
function pageUp() {
	if (trackingKeys==true || (trackingMouse==true && trackMouseY<parseInt(scrollThumb.style.top))) {
		scrollBy(viewHeight - 8);
	}
}

// scrollBy responds to a pixel delta for the content and adjusts the thumb;
// scrollContent responds to a thumb position and adjusts the content
function scrollBy (delta) {
	if (delta == 0) return;
	
	var newY  = currentContentTop + delta;
	
	if (delta < 0) { // scroll down
		// Don't scroll lower than the last page
		var lastPageY = -(currentContentHeight - viewHeight);
		currentContentTop = Math.max(lastPageY, newY);
	} else { // scroll up
		// Don't scroll above the top
		currentContentTop = Math.min(0, newY)
	}

	currentContent.style.top = currentContentTop + "px";	

	// reposition the scroll thumb based on the new page position
	scrollThumb.style.top = thumbPositionForPagePosition(currentContentTop) + "px";
//	var thumbBottom = parseInt(scrollThumb.style.top) + parseInt(scrollThumb.style.height);
//	DEBUG("scrollBy: thumbTop=" + scrollThumb.style.top + " thumbBottom=" + thumbBottom);
}

// Scroll the content based on the current scroller thumb position
function scrollContent(newThumbPosition) {
	// Correct if we're going to clip above the top or below the bottom
	if (newThumbPosition < SCROLLBAR_TOP) {
//		DEBUG("sc: thumb too high (" + newThumbPosition + ")");
		newThumbPosition = SCROLLBAR_TOP;
	} else if ((newThumbPosition + thumbHeight) > scrollBarHeight) {
//		DEBUG("sc: thumb too low (" + newThumbPosition + ")");
		newThumbPosition = scrollBarHeight - thumbHeight;
	}
		
	scrollThumb.style.top = newThumbPosition + "px";
	
	currentContentTop = pagePositionForThumbPosition(newThumbPosition);
//	DEBUG("sc: thumbTop=" + scrollThumb.style.top + " currentContentTop is " + currentContentTop);
	currentContent.style.top = currentContentTop + "px";
}

/*
 ********************************
 *	Utility / Math functions	*
 ********************************
 */
 
function getProportion (viewheight, documentheight) {
	if (documentheight <= viewheight)
		return 0;
	else
		return viewheight/documentheight;
}

// Given the position of the thumb, tell us what the content top should be.
// This is the key value that allows us to thumb-scroll.
function pagePositionForThumbPosition (thumbPosition) {
	DEBUG("ppftp: tp=" + thumbPosition + " st=" + SCROLLBAR_TOP + " cch=" + currentContentHeight + " vh=" + viewHeight + " nsp=" + numberOfScrollablePixels);
	return -(thumbPosition - SCROLLBAR_TOP) * ((currentContentHeight - viewHeight) / numberOfScrollablePixels);
}

// Given the position of the page, tell us where the thumb should be.
// This is the key value that allows us to track-scroll.
function thumbPositionForPagePosition (pagePosition) {
	DEBUG("tpfpp: pp=" + pagePosition + " cch=" + currentContentHeight + " vh=" + viewHeight + " nsp=" + numberOfScrollablePixels + " st=" + SCROLLBAR_TOP);
	var newThumbY = -(pagePosition / ((currentContentHeight - viewHeight) / numberOfScrollablePixels)) + SCROLLBAR_TOP;
	return Math.max(newThumbY, -1);
}

/*
 ****************************************
 *	Scroll timer for mouse/key tracking	*
 ****************************************
 */
 
var scrollTimer = {
	mouseAction:null,
	keyAction:null,
	timer:null
};

function setTimerMouseAction (newAction) {
	scrollTimer.mouseAction = newAction;
	startTimerWithDelay();
}

function setTimerKeyAction (newAction) {
	scrollTimer.keyAction = newAction;
	// if a mouseAction is in place, don't reset.
	// A new timer should start either to override an old keyAction,
	// or if there isn't one at all.
	if (scrollTimer.mouseAction == null) {
		startTimerWithDelay();
	}
}

function startTimerWithDelay () {
	clearTimer();
	window.setTimeout("startTimer();", PAGE_SKIP_PAUSE*2);
}

function startTimer () {
	clearTimer();
	if (scrollTimer.mouseAction == null && scrollTimer.keyAction == null) {
		return;
	}
	scrollTimer.timer = window.setInterval("doTimerAction();", PAGE_SKIP_PAUSE);
}

function clearTimer () {
	window.clearInterval(scrollTimer.timer);
	scrollTimer.timer = null;
}

function doTimerAction () {
	// mouseAction always trumps keyAction
	if (scrollTimer.mouseAction) {
		scrollTimer.mouseAction();
	} else if (scrollTimer.keyAction) {
		scrollTimer.keyAction();
	} else this.clearTimer();
}

/*
 ************************************************************************
 * debug code uses the div defined in Scroller.html/Scroller.css demo	*
 ************************************************************************
 */
var debugMode = false;

// write to the debug div.
function DEBUG(str) {
	if (debugMode) {
		if (window.widget) {
			alert(str);
		} else {
			var debugDiv = document.getElementById("debugDiv");
			debugDiv.appendChild(document.createTextNode(str));
			debugDiv.appendChild(document.createElement("br"));
			debugDiv.scrollTop = debugDiv.scrollHeight;		
		}
	}
}

// toggle the debugMode flag, but only show the debugDiv if we're in Safari
function toggleDebug() {
	debugMode = !debugMode;
	if (debugMode == true && !window.widget) {
		document.getElementById("debugDiv").style.display = "block";
	} else {
		document.getElementById("debugDiv").style.display = "none";
	}
}