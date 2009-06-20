/*

Copyright (c) 2005 Sean Billig
 sbillig@whatsinthehouse.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, and/or sublicense copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

[In other words, feel free to use any portion, no matter how large or small, of the code below in your own projects.  You are also welcome to use any of the other files found within the Wikipedia.wdgt bundle however you feel fit, provided they are not covered under their own licenses.  You don't need to ask me, or credit me unless you want to, but I am interested in hearing where the code is being used, just to satisfy my curiosity.  There are a handful of (modified) Apple scripts in the Scripts folder, which have their own license (a very open one, similar to this).]

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var langcode;
var flipper;
var previousX;
var previousY;
var stretcher;
//TODO: wrap history in object
var historyArray;
var historyCount;
var previousHistoryCount;
var replacedHistoryItem;
var historyPointer;
var lastHistoryAction;
var userName;
var progInd;
var currentInterface;
var currentVersion;
var lastUpdateCheckTime;
var windowCollapsed;
var backsideRequested;
var frontsideRequested;
var tempHeight;
var tempWidth;
var keyPressed;
var wikiReq;
var vSize;
var hSize;
var commentWindowOpen;

function makeSearchURL(url, search) {
	if (url.indexOf('index.php/') > -1)
		url = url.substring(0,url.indexOf("index.php/"));
	else
		url = url.substring(0,url.lastIndexOf("/")+1);
	return url+"index.php?search="+search+"&go=Go";
}
function makeStandardURL(url, page) {
	if (page == "") {
		url = url.substring(0,url.lastIndexOf("/")+1);
		alert("page is blank: "+url)
		return url;
	}
	
	if (url.indexOf('index.php?') > -1)
		url = url.substring(0,url.lastIndexOf("=")+1);
	else
		url = url.substring(0,url.lastIndexOf("/")+1);
		
	alert("page is not blank: "+url+page)
	return url+page;
}

function loaded() {
		
	vSize = 220;
	hSize = 367;
	
	flipper = new Fader(document.getElementById('flip'), null, 500);
	document.getElementById('wdgtContent').innerHTML = "";
	
	scrollerInit(document.getElementById("myScrollBar"), document.getElementById("myScrollTrack"), document.getElementById("myScrollThumb"));
	
	if (window.widget) {
		setDefaultMaxSize(widget.preferenceForKey(createKey("defaultMaxX")), widget.preferenceForKey(createKey("defaultMaxY")));
		setCacheAge(widget.preferenceForKey("CacheAge"));
		setLanguage(widget.preferenceForKey(createKey("langcode")));
		changeInterface(widget.preferenceForKey(createKey("Interface")));
		toggleCheckForUpdatesSetting(widget.preferenceForKey("checkForUpdatesSetting"));
		setFontSize(widget.preferenceForKey('FontSize'));
		
	}
	
	//(element, minY, maxY, minX, maxX, time)
	stretcher = new Stretcher(document.getElementById('wdgtFront'), 73, widget.preferenceForKey(createKey("defaultMaxY")), hSize, widget.preferenceForKey(createKey("defaultMaxX")), 250, stretchFinished);
	
	calculateAndShowThumb(document.getElementById('wdgtContent'));
	if (window.widget) {
		widget.system("mkdir ~/Library/Caches/WikipediaWidget", emptyFunction);
	}

	createGenericButton(document.getElementById('wdgtDoneButton'), getLocalizedString("Done"), showFront); 
	document.getElementById('updateMessage').innerHTML = getLocalizedString("update available");
	document.getElementById('languageLabel').innerHTML = getLocalizedString("Language code:");
	document.getElementById('cacheLabel').innerHTML = getLocalizedString("Max cache age:");
	document.getElementById('cacheMinutesLabel').innerHTML = getLocalizedString("minute(s)");
	document.getElementById('cacheButton').value = getLocalizedString("Empty Cache");
	document.getElementById('colorLabel').innerHTML = getLocalizedString("Color:");
	document.getElementById('blueOption').innerHTML = getLocalizedString("Blue");
	document.getElementById('greyOption').innerHTML = getLocalizedString("Grey");
	document.getElementById('greenOption').innerHTML = getLocalizedString("Green");
	document.getElementById('redOption').innerHTML = getLocalizedString("Red");

	document.getElementById('commentWindow').style.display = "none";
//	document.getElementById('purpleOption').innerHTML = getLocalizedString("Purple");

	createGenericButton(document.getElementById('submitCommentButton'), getLocalizedString("Submit"), submitComment);
	createGenericButton(document.getElementById('cancelCommentButton'), getLocalizedString("Cancel"), toggleCommentWindow); 
	
	document.getElementById('nameLabel').innerHTML = getLocalizedString("Name:");
	document.getElementById('commentLabel').innerHTML = getLocalizedString("Comments:");
	
	document.getElementById('checkForUpdatesLabel').innerHTML = getLocalizedString("Check for updates:");
		
	progInd = new ProgressIndicator(document.getElementById('progressGraphic'), "Images/prog");
	historyArray = new Array();
	historyCount = 0;
	historyPointer = 0;
	if (window.widget) {
		userName = widget.system("echo $USER", null).outputString.replace(/\n/, '');
	}
	currentVersion = getKeyValue("version.plist", "CFBundleVersion");
	commentWindowOpen = false;
	windowCollapsed = true;
	backsideRequested = false;
	frontsideRequested = false;
	tempHeight = widget.preferenceForKey(createKey("defaultMaxY"));
	tempWidth = widget.preferenceForKey(createKey("defaultMaxX"));
	lastUpdateCheckTime = 0;
	checkForUpdate();
	document.getElementById('versionNumber').innerHTML = currentVersion;
	if (window.widget) {
		widget.onshow = checkLastUpdateTime;
		widget.onremove = removalHandler;
	}

}

function removalHandler() {
	widget.setPreferenceForKey(null, createKey("langcode"));
	widget.setPreferenceForKey(null, createKey("Interface"));
	widget.setPreferenceForKey(null, createKey("defaultMaxX"));
	widget.setPreferenceForKey(null, createKey("defaultMaxY"));
}
function openLinkInBrowser(url) {
	if (window.widget) {
		url = encodeURI(url);
//		widget.openURL(encodeURIComponent(url));
		widget.system("open '"+url+"'", null);
		widget.openURL('');
	}
}
function openInBrowser() {
	if (document.getElementById('wdgtSearchInput').value.length > 0) {
		searchTerm = document.getElementById('wdgtSearchInput').value.replace(/[\s]/gi, '+');
		if (searchTerm.indexOf('=') < 0 && searchTerm.indexOf('&') < 0) {
			searchTerm = escape(searchTerm);
		}
		wikiUrl = 'http://'+langcode+'.wikipedia.org/wiki/Special:Search?search='+searchTerm+'&go=Go';

	} else {
		wikiUrl = 'http://' + langcode + '.wikipedia.org/wiki/';
	}
	if (window.widget) {
		widget.system("open '"+wikiUrl+"'", null);
		widget.openURL('');
	}
}

function searchWiki(search) {
	search = unescape(search);
	document.getElementById('wdgtSearchInput').value = search.replace(/_/g, ' ');
	if (search.length < 1) {
		displayContent('collapse');
		document.getElementById('wdgtSearchInput').value = "";
		//TODO: check for x button click
		//if (historyPointer == historyCount) {
		//	historyPointer++;
		//}
	} else {
		//TODO: if lancode is en, find/replace unicode characters?
		if (historyCount > 0) {
			rememberCurrentContentTop();
		}
		//TODO: upon history object creation, check if cache file name exists (in dir or in other history objects?), if so, modify file name
		var article = new HistoryObject(search, langcode);
		addToHistory(article);
		openArticle(article);
	}
}

function openArticle(article) {
	setSearchValue(article.name);
	if (window.widget) {
		widget.system("find ~/Library/Caches/WikipediaWidget -mmin +"+ widget.preferenceForKey("CacheAge") +" -delete", null);
	}
		
	req = new XMLHttpRequest();
	req.open("GET", article.file, false);
	req.send(null);
	response = req.responseText;
	req = null;

	if (response == null || response.length < 200) {
		progInd.start();
		requestArticle(article);
	} else {
		if (response.indexOf('<head>') > 0) {
			processRawHTML(response);
		} else {
			processCachedHTML(response);
		}
	}
	
}
function requestArticle(article) {
	if (langcode.length < 2) {
		output = "<p>"+getLocalizedString("<b>Please enter a Wikipedia language code</b> in the preference panel of this widget.  These are the letters (usually 2, sometimes 3 or more) found in the Wikipedia URL for your language: htt://XX.wikipedia.org, where XX is the language code.  Here are some common codes:") + "</p><ul><li>English - en</li><li>Deutsch - de</li><li>日本語 - ja</li><li>Français - fr</li><li>Svenska - sv</li><li>Polski - pl</li><li>Nederlands - nl</li><li>Español - es</li><li>Italiano - it</li><li>Português - pt</li><li>Simple English - simple</ul>";
		displayContent(output);
	} else {
		var l = article.lang;
		searchName = article.name;
		searchName = searchName.replace(/_/g, '+'); //.replace(/&/g, "%26")
		
		var specPage = false;
		
		if (searchName.indexOf('=')>0 && searchName.indexOf('&')>0) {
			specPage = true;
		}
		

		
		imageWords = new Array('Image:', '画像:','Bild:','Afbeelding:','Immagine:','Grafika:','Imagen:','Imagem:','תמונה:','Billede:');
		for (i=0;i<imageWords.length;i++) {
			if (!specPage) {
				if (searchName.indexOf(imageWords[i]) > -1) {
					specPage = true;
				}
			}
		}

		if (searchName.indexOf('&fulltext=Search') > -1) {
			specPage = false;
		}

		if (!specPage) {
				reqUrl = "http://"+article.lang+".wikipedia.org/wiki/Special:Search?search="+searchName+'&go=Go';
		} else {
			reqUrl = "http://"+article.lang+".wikipedia.org/w/index.php?title="+searchName;
		}
		
		wikiReq = new XMLHttpRequest();
		wikiReq.onreadystatechange = checkRequestResponse;
		wikiReq.open("GET", reqUrl, true);
		wikiReq.setRequestHeader("Cache-Control", "no-cache");
		wikiReq.send(null);
	}
}

function checkRequestResponse() {
	if (wikiReq.readyState == 4) {
		if (wikiReq.status == 200) {
			response = wikiReq.responseText;
			processRawHTML(response);
		} //todo: add else { display error
	}
}

function cancelArticleRequest() {
	//todo: this causes a history error (TypeError - Undefined value (line: 799)) on next article request
	wikiReq.abort();
	progInd.stop();
	if (historyPointer == historyCount) {
	//	alert('histPoint == histCount');
		removeCurrentItemFromHistory();
	} else {
		if (lastHistoryAction == 'back') {
			historyPointer++;
			setSearchValue(historyArray[historyPointer].name);
			enableBackButton();
			if (historyPointer == historyCount) {
				disableForwardButton();
			}
		} else {
			if (historyPointer > 1) {
				historyPointer--;
				setSearchValue(historyArray[historyPointer].name);
				enableForwardButton();
				if (historyPointer == 1) {
					disableBackButton();
				}
			}
		}
	}
	if (stretcher.isStretched() == false) {
		setSearchValue('');
	} else {
		setSearchValue(historyArray[historyPointer].name);
	}
}

function processCachedHTML(input) {
	input = input.replace(/qzq/g, "'");
	displayContent(input);
}
function processRawHTML(input) {
	var start = 0;
	var end = 0;
	resultsIndex = input.indexOf("<div id='results'>");
	if (resultsIndex > -1) {
		start = resultsIndex;
		if (input.indexOf("<form id=\"powersearch\"") > -1) {
			end = input.indexOf("<form id=\"powersearch\"");
//			wlinkPattern = /a\shref="\/w\/index.php\?title=Special:Search&amp;search=([^>]+)/g;
//			wlinkReplace = 'a href=\'javascript:searchWiki("$1)\'';
//			input = input.replace(wlinkPattern, wlinkReplace);
		} else if (input.indexOf("<!-- Google search -->") > -1) {
			end = input.indexOf("<!-- Google search -->");
		} else {
			end = input.indexOf("<!-- end content -->");
		}
	} else {
		if (input.indexOf('nostalgia.css') > 0) {
			start = input.indexOf('<p>');
		} else {
			start = input.indexOf('<h1 class="firstHeading">');
			if (start < 0) {
				start = input.indexOf('<h1 class="pagetitle">');
			}
		}
		end = input.indexOf("<!-- end content -->");
		if (end < 0) {
			end = input.indexOf('<div class="printfooter">');
		}
	}
	output = input.substring(start, end);
	
	tocPattern = /a\shref="\#([^"]+)"/g;
	tocReplace = 'a href=\'javascript:scrollToAnchor("$1")\'';
	output = output.replace(tocPattern, tocReplace);

	wikiPattern = /href=\n*"\/wiki\/(\S+)\stitle=[^>]+/g;
	wikiReplace = 'href=\'javascript:searchWiki("$1)\'';
	output = output.replace(wikiPattern, wikiReplace);
	
	loginUrl = 'http://'+langcode+'.wikipedia.org/wiki/Special:Userlogin';		
	
	loginPattern = 'searchWiki("Special:Userlogin")';
//	loginReplace = 'openLinkInBrowser("http://'+langcode+'.wikipedia.org/wiki/Special:Userlogin")';
	loginReplace = 'openLinkInBrowser("'+loginUrl+'")';
	output = output.replace(loginPattern, loginReplace);
//	Special:Userlogin
//	output = output.replace()

	imgPattern = /href=\n*"\/wiki\/(\S+)/g;
	imgReplace = 'href=\'javascript:searchWiki("$1)\'';
	output = output.replace(imgPattern, imgReplace);

	searchResNumPattern = /href="\/w\/index.php\?title=Special:Search&amp;search=([^&]+)([^"]+)"/g
	searchResNumReplace = 'href=\'javascript:searchWiki("$1$2");\'';
	output = output.replace(searchResNumPattern, searchResNumReplace);

	newEditPattern = /href="\/w\/index.php\?title=([^"]+)"/g
	newEditReplace = 'href=\'javascript:searchWiki("$1");\'';
	output = output.replace(newEditPattern, newEditReplace);
	
/*	editPattern = /href=\n*"\/(^>\S+)/g;
	editReplace = 'href=\'javascript:openLinkInBrowser("http://' + langcode + '.wikipedia.org/$1)\'';
	output = output.replace(editPattern, editReplace);
*/	
	extPattern = /href=\n*"([^\s>]+)/g;
	extReplace = 'href=\'javascript:openLinkInBrowser("$1)\'';
	output = output.replace(extPattern, extReplace);
	
	srcUrl = 'http://'+langcode+'.wikipedia.org/';		
	
	srcPattern = /src=\n*"\//g;
	srcReplace = 'src="'+srcUrl;
	output = output.replace(srcPattern, srcReplace);
	//"
	
	//<div id="jump-to-nav">Jump to: <a href="#column-one">navigation</a>, <a href="#searchInput">search</a></div>
	jumpnavPattern = /<div id="jump-to-nav">[^q]+?<\/div>/;
	output = output.replace(jumpnavPattern, '');
	
	submit1Pattern = /<input type=['"]submit["'] name=['"]([^'"]+)["']/g;
	submit1Replace = '<input type=\'submit\' name=\'$1\' onclick=\'processForm("$1")\''
	output = output.replace(submit1Pattern, submit1Replace);
	
	submit2Pattern = /<input(.*?)name=['"]([^'"]+)["'] type=['"]submit["']/g;
	submit2Replace = '<input$1type=\'submit\' name=\'$2\' onclick=\'processForm("$2")\''
	output = output.replace(submit2Pattern, submit2Replace);
	
/*	textareaPattern = /<textarea /g;
	textareaReplace = '<textarea onmousemove="wiggleScrollBar();" ';
	output = output.replace(textareaPattern, textareaReplace)*/
	
//	titlePattern = /title="[^"]+"/g;
  //  output = output.replace(titlePattern, '');
	
	displayContent(output);
	//todo: standard: <h1 class="firstHeading">
	//		classic:  <h1 class="pagetitle">
	nameStart = input.indexOf('<h1 class="firstHeading">') + 25;
	if (nameStart < 25)
		nameStart = input.indexOf('<h1 class="pagetitle">') + 22;
	nameEnd = input.indexOf("</h1>");
	properName = input.substring(nameStart, nameEnd);
	properName = properName.replace('&amp;', '&');
	if (historyArray[historyPointer].name == "Special:Randompage") {
		document.getElementById('wdgtSearchInput').value = properName;
		resetHistoryObject(properName, langcode);
		document.getElementById('randomLink').src = "Images/randomOff.png";
	}
	
	historyArray[historyPointer].properURL = "http://"+historyArray[historyPointer].lang+".wikipedia.org/wiki/"+properName.replace(/\s/g, '_');
	
	output = output.replace(/'/g, "qzq");
	output = output.replace(/\t/g, " ");
	output = output.replace(/\n/g, " ");
	output = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"> '+output;
	if (window.widget)
		widget.system("echo '"+output+"' > "+historyArray[historyPointer].file, emptyFunction);
		
}
function scrollToAnchor(anchorName) {
	var a = document.getElementById(anchorName);
	if (!a)
		a = document.anchors[anchorName];
	var anchorPosition = a.offsetTop + currentContentTop;
	scrollBy(-anchorPosition);
}


function displayContent(input) {
	if (input == "collapse") {
		input = "";
		
		if (stretcher.isStretched() == true) {
			document.getElementById('ResizeBox').style.display = "none";
			stretcher.stretch(event);
		}
		document.getElementById('editButton').style.display = "none";
		document.getElementById('editButton').innerHTML = '';
		document.getElementById('fontSizeSmaller').innerHTML = '';
		document.getElementById('fontSizeBigger').innerHTML = '';
		//todo: why does this not work? ^
//		document.getElementById('editButton').style.opacity = "0";
//		document.getElementById('editButton').style.fontSize = "1px";
		
	} else if (stretcher.isStretched() == false) {
		document.getElementById('ResizeBox').style.display = "block";
		document.getElementById('editButton').style.display = 'block';
		document.getElementById('editButton').innerHTML = '✍';
		document.getElementById('fontSizeSmaller').innerHTML = 'A';
		document.getElementById('fontSizeBigger').innerHTML = 'A';
		document.getElementById('editButton').onclick = function() { searchWiki(historyArray[historyPointer].name + '&action=edit') }
		stretcher.stretch(event);
	}
	
	progInd.stop();
	document.getElementById('wdgtContent').innerHTML = input;
	calculateAndShowThumb(document.getElementById('wdgtContent'));
	if (historyCount > 0) {
	//	alert('histCount > 0')
		document.getElementById('wdgtSearchInput').value = historyArray[historyPointer].name.replace(/_/g, ' ');
		
	}	
	calculateAndShowThumb(document.getElementById('wdgtContent'));
	scrollBy(55000);
	if (historyArray[historyPointer]) {
		scrollBy(historyArray[historyPointer].contentTop);
	}
	if (document.getElementById('wdgtSearchInput').value.indexOf("#") > 0) {
		anchorPattern = /(\w+)#/g;
		anchor = document.getElementById('wdgtSearchInput').value.replace(/\s/g, '_').replace(anchorPattern, "");
		scrollToAnchor(anchor);
	}
	
	if (document.getElementById('wpTextbox1')) {
		document.getElementById('wpTextbox1').rows = 15;
	}
//	stretcher.stretch(event);
	if (document.forms[0]) {
		f = document.forms[0];
		var e;
		for (var i=0; i<f.length; i++) {

			e = f.elements[i];
			if (e.type == 'textarea') {

			}
			
//			alert(f.elements[i].name +':'+ f.elements[i].type);
		}
	}
	
}

function processForm(buttonName) {
	//alert('called by: '+buttonName);
	f = window.document.forms[0];
	var postStr = '';
	for (var i=0; i<f.length; i++) {

		e = f.elements[i];
		switch (e.type) {
			case ('submit'):
				if (e.name == buttonName) {
					if (i>0) { postStr += '&'; }
					postStr += e.name+'='+e.value.replace(' ','+');
				}
				break;
			case ('checkbox'):
				if (e.checked) {
					if (i>0) { postStr += '&'; }
					postStr += e.name+'='+e.value;
				}
				break;
			case ('textarea'):
				if (i>0) { postStr += '&'; }
				postStr += e.name+'='+encodeURIComponent(e.value)
			//	postStr += e.name+'='+escape(e.value);
				break;
			default:
				if (i>0) { postStr += '&'; }
				postStr += e.name+'='+e.value;
				break;
		}
//		alert(f.elements[i].name +':'+ f.elements[i].type);
	}
//	alert('postStr: '+postStr)
	
	formUrl = 'http://'+langcode+'.wikipedia.org'+ f.action;
	
	wikiReq = new XMLHttpRequest();
	wikiReq.onreadystatechange = checkRequestResponse;
	wikiReq.open("POST", formUrl, false);	
	wikiReq.setRequestHeader("Cache-Control", "no-cache");
	wikiReq.send(postStr);
}

//this following function is taken from http://en.wikipedia.org/skins-1.5/common/wikibits.js?1
//for compatibility with edit pages (I cut out the IE stuff and some comments)
function insertTags(tagOpen, tagClose, sampleText) {
	if (document.editform)
		var txtarea = document.editform.wpTextbox1;
	else {
		// some alternate form? take the first one we can find
		var areas = document.getElementsByTagName('textarea');
		var txtarea = areas[0];
	}

	if(txtarea.selectionStart || txtarea.selectionStart == '0') {
		var replaced = false;
		var startPos = txtarea.selectionStart;
		var endPos = txtarea.selectionEnd;
		if (endPos-startPos)
			replaced = true;
		var scrollTop = txtarea.scrollTop;
		var myText = (txtarea.value).substring(startPos, endPos);
		if (!myText)
			myText=sampleText;
		if (myText.charAt(myText.length - 1) == " ") { // exclude ending space char, if any
			subst = tagOpen + myText.substring(0, (myText.length - 1)) + tagClose + " ";
		} else {
			subst = tagOpen + myText + tagClose;
		}
		txtarea.value = txtarea.value.substring(0, startPos) + subst +
			txtarea.value.substring(endPos, txtarea.value.length);
		txtarea.focus();
		//set new selection
		if (replaced) {
			var cPos = startPos+(tagOpen.length+myText.length+tagClose.length);
			txtarea.selectionStart = cPos;
			txtarea.selectionEnd = cPos;
		} else {
			txtarea.selectionStart = startPos+tagOpen.length;
			txtarea.selectionEnd = startPos+tagOpen.length+myText.length;
		}
		txtarea.scrollTop = scrollTop;

	}
	// reposition cursor if possible
	if (txtarea.createTextRange)
		txtarea.caretPos = document.selection.createRange().duplicate();
}

function selectSearchInput() {
	document.getElementById('wdgtSearchInput').select();
	//a little slow, perhaps?
	document.getElementById('wdgtSearchInput').select();
}
function setSearchValue(input) {
	document.getElementById('wdgtSearchInput').value = input.replace(/_/gi, ' ');
}
function stretchFinished() {
	if (backsideRequested == true) {
		setTimeout( function() { transitionToBack(); }, 30); 
	} else if (frontsideRequested == true) {
		frontsideRequested = false;
		stretcher.minVertPosition = 73;
	}
	calculateAndShowThumb(document.getElementById('wdgtContent'));
}
function setDefaultMaxSize(x, y) {
//	alert('setDefaultSize, x: '+x+' y: '+y)
	if (typeof(x) == "undefined" || x == "undefined" || x == '') {
		x = hSize;
	}
	if (typeof(y) == "undefined" || y == "undefined" || y == '' || y < vSize) {
		y = vSize;
	}
	
	widget.setPreferenceForKey(x, createKey("defaultMaxX"));
	widget.setPreferenceForKey(y, createKey("defaultMaxY"));		
}
function setCacheAge(minutes) {
	if (typeof(minutes) == "undefined" || minutes == "undefined") {
		minutes = 5;
	} else if (minutes == '') {
		minutes = 0;
	}
	if (window.widget) {
		widget.setPreferenceForKey(minutes, "CacheAge");
	}
}
function setLanguage(language) {
	if (typeof(language) == "undefined" || language == "undefined" || language == "") {
		language = getLocalizedString("en");
	}
	langcode = language;
	switch (langcode) {
		case "en": langname = "English"; break;
		case "fr": langname = "Français"; break;
		case "ja": langname = "日本語"; break;
		case "sv": langname = "Svenska"; break;
		case "nl": langname = "Nederlands"; break;
		case "it": langname = "Italiano"; break;
		case "de": langname = "Deutsch"; break;
		case "pl": langname = "Polski"; break;
		case "es": langname = "Español"; break;
		case "pt": langname = "Português"; break;
		case "he": langname = "עברית"; break;
		case "zh": langname = "中文"; break;
		case "bg": langname = "Български"; break;
		case "ru": langname = "Русский"; break;
		case "uk": langname = "Українська"; break;
		case "ca": langname = "Català"; break;
		case "da": langname = "Dansk"; break;
		case "no": langname = "Norsk"; break;
		case "ro": langname = "Română"; break;
		case "sr": langname = "Српски"; break;
		case "sl": langname = "Slovenščina"; break;
		case "fi": langname = "Suomi"; break;
		case "mt": langname = "Malti"; break;
		case "ko": langname = "한국어"; break;
		case "sa": langname = "संस्कृतम्"; break;
		case "fa": langname = "فارسی"; break;
		case "ar": langname = "العربية"; break;
		case "el": langname = "Ελληνικά"; break;
		case "hi": langname = "हिन्दी"; break;
		case "af": langname = "Afrikaans"; break;
		case "ast": langname = "Asturianu"; break;
		case "be": langname = "Беларуская"; break;
		case "bs": langname = "Bosanski"; break;
		case "cs": langname = "Česká"; break;
		case "cy": langname = "Cymraeg"; break;
		case "et": langname = "Eesti"; break;
		case "simple": langname = "Simple English"; break;
		case "eu": langname = "Euskara"; break;
		case "fy": langname = "Frysk"; break;
		case "gd": langname = "Gàidhlig"; break;
		case "gl": langname = "Galego"; break;
		case "hr": langname = "Hrvatski"; break;
		case "io": langname = "Ido"; break;
		case "id": langname = "Bahasa Indonesia"; break;
		case "ia": langname = "Interlingua"; break;
		case "is": langname = "Íslenska"; break;
		case "ku": langname = "Kurdî / كوردی"; break;
		case "la": langname = "Latina"; break;
		case "lv": langname = "Latviešu"; break;
		case "lb": langname = "Lëtzebuergesch"; break;
		case "lt": langname = "Lietuvių"; break;
		case "hu": langname = "Magyar"; break;
		case "ms": langname = "Bahasa Melayu"; break;
		case "nn": langname = "Norsk (nynorsk)"; break;
		case "nds": langname = "Plattdüütsch"; break;
		case "sk": langname = "Slovenčina"; break;
		case "tt": langname = "Tatarça"; break;
		case "tr": langname = "Türkçe"; break;
		case "th": langname = "ไทย"; break;
		case "wa": langname = "Walon"; break;
		default:   langname = langcode;
	}
	document.getElementById('wdgtSearchInput').setAttribute('placeholder', langname);
	if (window.widget) {
		widget.setPreferenceForKey(langcode, createKey("langcode"));
	}
}

function languageSelectDidChange() {
	var selectedIndex = document.getElementById('languageSelect').selectedIndex;
	var selection = document.getElementById('languageSelect').options[selectedIndex].value;
	
	if (selection == 'other') {
		document.getElementById('languageField').value = '';
	} else {
		document.getElementById('languageField').value = selection;
	}
}
function languageFieldDidChange() {
	var fieldValue = document.getElementById('languageField').value.toLowerCase();
	var optionsList = document.getElementById('languageSelect').options;

	var inList = false;
	for (i=0; i<optionsList.length; i++) {
		if (optionsList[i].value == fieldValue) {
			document.getElementById(fieldValue + 'Option').selected = true;
			inList = true;
			break;
		}
	}
	if (!inList) {
		document.getElementById('otherLangOption').selected = true;
	}
}

function showContextMenu(event) {
//	alert(event.location.id)
}
function getKeyValue(plist, key) { 
   var xml_http = new XMLHttpRequest(); 
   xml_http.open("GET", plist, false); 
   xml_http.send(null); 
	
   var xml = xml_http.responseXML; 
   var keys = xml.getElementsByTagName("key"); 
   var vals = xml.getElementsByTagName("string"); 
   var key_value; 
	
   for (var i=0; i < keys.length; i++) { 
	  if (keys[i].firstChild.data == key) { 
		 key_value = vals[i].firstChild.data; 
		 break; 
	  } 
   } 
	
   return key_value; 
}

function toggleCheckForUpdatesSetting(setting) {
	if (typeof(setting) == "undefined" || setting == "undefined" || setting == '') {
		setting = true;
	}
	widget.setPreferenceForKey(setting, "checkForUpdatesSetting");
}
function checkLastUpdateTime() {
	dateNow = new Date(); 
	dateNow = Math.round(dateNow.getTime() / 1000); 

	if (((dateNow - lastUpdateCheckTime) >= 86400) && (widget.preferenceForKey("checkForUpdatesSetting"))) {
		checkForUpdate();
	}
}
function checkForUpdate() {
	req = new XMLHttpRequest();
	req.onreadystatechange = compareVersion;
	req.open("GET", "http://www.whatsinthehouse.com/widgets/wikiVersion.php", true);
	req.setRequestHeader("Cache-Control", "no-cache");
	req.send(null);
}
function compareVersion() {
	//todo: Null value
	if (req.readyState == 4) {
		if (req.status == 200) {
			dateNow = new Date();
			dateNow = Math.round(dateNow.getTime() / 1000);
			lastUpdateCheckTime = dateNow;
	   
			var serverVersion = req.responseText;
			if ((currentVersion != serverVersion) && (serverVersion != null) && (serverVersion != "")) {
				document.getElementById('updateMessage').style.display='block';
			} else {
				document.getElementById('updateMessage').style.display='none';
			}
		}
	}
}
function toggleCommentWindow() {
	var commentWindow = document.getElementById('commentWindow');
	if (commentWindow.style.display == "none") {		
		commentWindow.style.opacity="0.98";
		commentWindow.style.display="block";
		selectNameField();
		
	} else {
		commentWindow.style.display="none";
	}
}
function submitComment() {
	commentReq = new XMLHttpRequest();
	commentReq.onreadystatechange = updateCommentStatus;
	commentReq.open("POST", "http://www.whatsinthehouse.com/widgets/postComment.php", true);
	commentReq.setRequestHeader("Cache-Control", "no-cache");
	commentReq.send("source=widget&name="+nameField.value+"&comment="+commentField.value);
	toggleCommentWindow();
}
function updateCommentStatus() {
	if (commentReq.readyState == 4) {
		if (commentReq.status == 200) {
			if (commentReq.responseText == "success") {
				document.getElementById('commentStatusMessage').innerText='✓';
			} else {
				document.getElementById('commentStatusMessage').innerText='✗';
			}
		}
	}
}
function selectNameField() {
	document.getElementById('nameField').focus();
}

function setFontSize(size) {
	if (typeof(size) == "undefined" || size == "undefined" || size == '') {
		size = 12;
	}
	
	var oldSize = parseInt(document.body.style.fontSize);
	var newSize = oldSize;
	
	switch(size) {
		case('up'):
			if (oldSize < 22) {
				newSize = oldSize + 1;
			}
			break;
		case('down'):
			if (oldSize > 9) {
				newSize = oldSize - 1;
			}
			break;
		default:
			newSize = size;
	}
	widget.setPreferenceForKey(newSize, 'FontSize');
	document.body.style.fontSize = newSize+'px';
}

function showBackside(event) {	
	if (window.innerHeight > vSize - 10 || window.innerWidth > hSize || stretcher.isStretched()) {
		transitionToBack();
	} else {
		backsideRequested = true;
		tempHeight = stretcher.maxVertPosition;
		tempWidth = stretcher.maxHorizPosition;
		stretcher.maxVertPosition = vSize+8;
		stretcher.maxHorizPosition = hSize;
		stretcher.stretch(event);
	}
}
function getDomainName(url) {
	return url.replace(/https?:\/\/([^\/]+).+/, "$1").replace('www.', '');

}

function transitionToBack() {
	if (window.widget) {
		window.widget.prepareForTransition("ToBack");
	}

	document.getElementById('fliprollie').style.display='none';
	document.getElementById('wdgtFront').style.display='none';
	document.getElementById('parentDiv').style.display='none';
	document.getElementById('wdgtSearchInput').style.display='none';
	document.getElementById('wikiLink').style.display='none';
	document.getElementById('randomLink').style.display='none';
	document.getElementById('wdgtBack').style.display='block';

	document.getElementById('languageField').value = langcode;
	languageFieldDidChange();
	document.getElementById('cacheField').value = widget.preferenceForKey("CacheAge");
	document.getElementById('checkForUpdatesBox').checked = widget.preferenceForKey("checkForUpdatesSetting");
	
	document.getElementById(currentInterface + 'Option').selected = true;

	//Adjust the done button position for Français, Español y Deutsch
	var doneText = getLocalizedString("Done");
	if (doneText.indexOf("Terminé") > -1) {
		document.getElementById('wdgtDoneButton').style.left = "248px";
	} else if (doneText.indexOf("Hecho") > -1) {
		document.getElementById('wdgtDoneButton').style.left = "258px";
	} else if (doneText.indexOf("Fertig") > -1) {
		document.getElementById('wdgtDoneButton').style.left = "262px";
	}
	
	if (window.widget) {
		setTimeout("window.widget.performTransition()", 0);
	}
}

function showFront(event) {
	if (window.widget) {
		window.widget.prepareForTransition("ToFront");
	}
	//alert('showing front... stretched = '+stretcher.isStretched())
	document.getElementById('wdgtBack').style.display='none';
	
	document.getElementById('wdgtFront').style.display='block';
	document.getElementById('parentDiv').style.display='block';
	document.getElementById('wikiLink').style.display='block';
	document.getElementById('randomLink').style.display='block';
	document.getElementById('wdgtSearchInput').style.display='block';
	document.getElementById('commentStatusMessage').innerText='';
	setLanguage(document.getElementById('languageField').value);
	setCacheAge(document.getElementById('cacheField').value);

	toggleCheckForUpdatesSetting(document.getElementById('checkForUpdatesBox').checked);
	if (document.getElementById('colorSelect').value != currentInterface) {
		changeInterface(document.getElementById('colorSelect').value);
	}
	
	if (window.widget) {
		setTimeout("window.widget.performTransition()", 0);
	}
	if (backsideRequested == true) {
		backsideRequested = false;
		frontsideRequested = true;
		setTimeout( function() { stretcher.stretch(event); }, 800); 
	}
}

function emptyFunction(input) {
	return;
}

function emptyCache() {
	if (window.widget) {
		widget.system("find ~/Library/Caches/WikipediaWidget -mmin +0 -delete", null);
	}
}

/******** Progress Indicator *********/

function ProgressIndicator(element, imageBaseURL) {
	this.count = 0;
	this.timer = null;
	this.element = element;
	this.element.style.display = "none";
	this.imageBaseURL = imageBaseURL;
}

ProgressIndicator.prototype = {
	start : function () {
		this.element.style.display = "block";		
		if (this.timer) clearInterval(this.timer);
		this.tick();
		var localThis = this;
		this.timer = setInterval (function() { localThis.tick() }, 60);
	},

	stop : function () {
		clearInterval(this.timer);
		this.element.style.display = "none";
		document.getElementById("cancelButton").style.display="none";
	},

	tick : function () {
		var imageURL = this.imageBaseURL + (this.count + 1) + ".png";
		this.element.src = imageURL;
		this.count = (this.count + 1) % 12;
	}
}


function changeInterface(input) {
	if (input == "undefined" || typeof(input) == "undefined" || input == "") {
		input = "blue";
	}
	document.getElementById('topBarLeft').style.backgroundImage = "url('Images/topBarLeft-"+input+".png')";
	document.getElementById('topBarMiddle').style.backgroundImage = "url('Images/topBarMiddle-"+input+".png')";
	document.getElementById('topBarRight').style.backgroundImage = "url('Images/topBarRight-"+input+".png')";
	document.getElementById('centerLeft').style.backgroundImage = "url('Images/centerLeft-"+input+".png')";
	document.getElementById('centerMiddle').style.backgroundImage = "url('Images/centerMiddle-"+input+".png')";
	document.getElementById('centerRight').style.backgroundImage = "url('Images/centerRight-"+input+".png')";
	document.getElementById('bottomBarLeft').style.backgroundImage = "url('Images/bottomBarLeft-"+input+".png')";
	document.getElementById('bottomBarMiddle').style.backgroundImage = "url('Images/bottomBarMiddle-"+input+".png')";
	document.getElementById('bottomBarRight').style.backgroundImage = "url('Images/bottomBarRight-"+input+".png')";
	
	currentInterface = input;
	widget.setPreferenceForKey(input, createKey("Interface"));
	
	var lc, dc;
	switch(input) {
		case ('red'):
			lc = '833F2F';
			dc = '5D2D22';
			break;
		case ('green'):
			lc = '3C8B1D';
			dc = '2B6016';
			break;
		case ('grey'):
			lc = '757575';
			dc = '5C5C5C';
			break;
		default:
			lc = '4682B4';
			dc = '38688F';
	}
	lc = '#'+lc;
	dc = '#'+dc;
	var elems = new Array('updateMessage','editButton','fontSizeSmaller','fontSizeBigger');
	for(var key in elems) {
		var el = document.getElementById(elems[key]);
		el.style.color = lc;
		el.onmouseover = function() {this.style.color = dc;}
		el.onmouseout = function() {this.style.color = lc;}
	}


}

function copyProperURL() {
	if (window.widget) {
		//todo: escape proper name, rather than encoding url
		var copyCommand = "/usr/bin/osascript -e 'set the clipboard to \""+encodeURI(historyArray[historyPointer].properURL)+"\" as string'";
		widget.system(copyCommand, null);
	}
}

/******** History stuff *********/

function HistoryObject(name, lang) {
	name = name.replace(/\s/g, '_');
	this.name = name;
	this.lang = lang;
	this.nameForFile = name.replace(':', '-').replace(/[(]/g, "lp").replace(/[)]/g, "rp").replace(/'/g, 'qt').replace(/&/g, 'amp');
	//alert(this.nameForFile);
	sameNameForFileCount = 0;
	if (historyArray.length > 0) {
		for (i=1; i<historyArray.length; i++) {
			if (historyArray[i].nameForFile.toLowerCase() == this.nameForFile.toLowerCase()) {
				sameNameForFileCount++;
			}
		}
	}
	if (sameNameForFileCount == 0) {
		this.file = "/Users/"+userName+"/Library/Caches/WikipediaWidget/"+lang+"_"+this.nameForFile+".html";
	} else {
		this.file = "/Users/"+userName+"/Library/Caches/WikipediaWidget/"+lang+"_"+this.nameForFile+"."+sameNameForFileCount+".html";
	}
	this.properURL = "http://"+this.lang+".wikipedia.org/wiki/";	
	this.contentTop = 0;
}
function addToHistory(item) {
		historyPointer++;
		replacedHistoryItem = historyArray[historyPointer];
		historyArray[historyPointer] = item;
		/*  This screws up cancelArticleRequest
		for (i = historyPointer+1; i < historyCount; i++) {
			historyArray[i] = null;
		}*/
		previousHistoryCount = historyCount;
		historyCount = historyPointer;
		disableForwardButton();
		if (historyPointer > 1) {
			enableBackButton();
		}
}
function removeCurrentItemFromHistory() {
		historyArray[historyPointer] = replacedHistoryItem;
		
		historyCount = previousHistoryCount;
		historyPointer--;
		if (historyPointer < historyCount) {
			enableForwardButton();
		}
		if (historyPointer == 1) {
			disableBackButton();
		}
}

function resetHistoryObject(name, lang) {
	historyArray[historyPointer] = new HistoryObject(name, lang);
}

function rememberCurrentContentTop() {
	historyArray[historyPointer].contentTop = currentContentTop;
}
function goBackInHistory() {
	if (historyPointer > 1) {
		rememberCurrentContentTop();
		historyPointer--;
		openArticle(historyArray[historyPointer]);
		setSearchValue(historyArray[historyPointer].name);
		enableForwardButton();
		if (historyPointer == 1) {
			disableBackButton();
		}
		lastHistoryAction = 'back';
	}
}
function goForwardInHistory() {
	if (historyPointer < historyCount) {
		rememberCurrentContentTop();
		historyPointer++;
		openArticle(historyArray[historyPointer]);
		setSearchValue(historyArray[historyPointer].name);
		enableBackButton();
		if (historyPointer == historyCount) {
			disableForwardButton();
		}
		lastHistoryAction = 'forward';
	}
}

function enableBackButton() {
	document.getElementById('backButton').src = "Images/backButtonOn.png";
}
function disableBackButton() {
	document.getElementById('backButton').src = "Images/backButtonOff.png";
}
function enableForwardButton() {
	document.getElementById('forwardButton').src = "Images/forwardButtonOn.png";
}
function disableForwardButton() {
	document.getElementById('forwardButton').src = "Images/forwardButtonOff.png";
}

/******** Window resizing *********/

var lastPos;
function mouseDown(event)
{
	var x = event.x + window.screenX;
	var y = event.y + window.screenY;
	
	document.addEventListener("mousemove", mouseMove, true);
	document.addEventListener("mouseup", mouseUp, true);
	lastPos = {x:x, y:y};
	event.stopPropagation();
	event.preventDefault();
}

function mouseMove(event)
{
	var screenX = event.x + window.screenX;
	var screenY = event.y + window.screenY;
	
	var deltaX = 0;
	var deltaY = 0;
	
	if ( (window.innerWidth + (screenX - lastPos.x)) >= hSize ) {
		deltaX = screenX - lastPos.x;
		lastPos.x = screenX;
	}
	if ( (window.innerHeight + (screenY - lastPos.y)) >= vSize ) {
		deltaY = screenY - lastPos.y;
		lastPos.y = screenY;
	}
	document.getElementById('wdgtFront').style.width = parseInt(document.getElementById('wdgtFront').style.width) + deltaX;
	document.getElementById('wdgtFront').style.height = parseInt(document.getElementById('wdgtFront').style.height) + deltaY;
	window.resizeBy(deltaX, deltaY);
	calculateAndShowThumb(document.getElementById('wdgtContent'));
	event.stopPropagation();
	event.preventDefault();
} 
function mouseUp(event)
{
	var newWidth = parseInt(document.getElementById('wdgtFront').style.width);
	var newHeight = parseInt(document.getElementById('wdgtFront').style.height);
	window.resizeTo(newWidth, newHeight);
	document.removeEventListener("mousemove", mouseMove, true);
	document.removeEventListener("mouseup", mouseUp, true); 
	event.stopPropagation();
	event.preventDefault();
	setDefaultMaxSize(newWidth, newHeight);
}


function createKey(name) {
	return widget.identifier + "-" + name;
}
function getLocalizedString(key) {
	try {
		var ret = localizedStrings[key];
		if (ret === undefined)
			ret = key;
		return ret;
	} catch (ex) {}
	return key;
}