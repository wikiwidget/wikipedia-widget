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
var stretcher;
var historian;
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
	
	contentDiv = document.getElementById('wdgtContent');
	contentDiv.innerHTML = "";
	
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
	
	calculateAndShowThumb(contentDiv);
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
	
	
	historian = {
		
		items: [],
		pointer: -1,
		
		currentItem: function() {
			if (this.items.length == 0)
				return null;
			return this.items[this.pointer];
		},
		
		add: function (item) {
			this.pointer++;
			this.items[this.pointer] = item;
			/* chop off everything after the item we just inserted */
			this.items.splice(this.pointer+1)
			
			disableForwardButton();
			if (! this.atStart()) {
				enableBackButton();
			}
		},
		
		rememberCurrentContentTop: function() {
			if (this.items.length > 0)
				this.currentItem().contentTop = getContentTop();
		},
		
		atStart: function() { return this.pointer == 0 },
		atEnd: function() { return this.pointer == this.items.length - 1 },
		
		goBack: function() {
			if (! this.atStart()) {
				this.currentItem().contentTop = getContentTop();
				this.pointer--;
				searchWiki(this.currentItem().name, true);
				enableForwardButton();
				if (this.atStart()) {
					disableBackButton();
				}				
			}
		},
		goForward: function () {
			if (! this.atEnd()) {
				this.currentItem().contentTop = getContentTop();
				this.pointer++;
				searchWiki(this.currentItem().name, true);
				enableBackButton();
				if (this.atEnd())
					disableForwardButton();
			}
		}
	};
	historian.items.push(1);
	
	progInd = new ProgressIndicator(document.getElementById('progressGraphic'), "Images/prog");

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

function searchWiki(search, isHistoryRequest) {
	if (search.length < 1) {
		collapseWidget();
		displayContent('');
		document.getElementById('wdgtSearchInput').value = "";
		return;
	}
	
	if (isHistoryRequest == undefined) {
		isHistoryRequest = false;
	}
	
	//historian.rememberCurrentContentTop();
	
	search = unescape(search);
	document.getElementById('wdgtSearchInput').value = search.replace(/_/g, ' ');
	
	/* delete old cached files */
	if (window.widget) {
		widget.system("find ~/Library/Caches/WikipediaWidget -mmin +"+ widget.preferenceForKey("CacheAge") +" -delete", null);
	}
	
	var req = new XMLHttpRequest();
	req.open("GET", filePathForArticleName(search), false);
	//TODO: if history object is created with properName, and the file is named after properName, then subsequent searches for
	//  something like "duluth mn" won't use the cached file, but will repeatedly write more cached files
	req.send(null);
	response = req.responseText;
	req = null;
	
	if (response != null && response.length > 200) {
		displayContent(decodeURI(response));
		if (! isHistoryRequest) {
			historian.add(new HistoryObject(search, langcode));
		}
	} else {
		progInd.start();
		
		searchName = search.replace(/_/g, '+').replace(/ /g, '+'); //.replace(/&/g, "%26")
		
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

		// TODO: if isHistoryRequest, use <current hist object>.lang
		if (!specPage) {
			reqUrl = "http://"+langcode+".wikipedia.org/wiki/Special:Search?search="+searchName+'&go=Go';
		} else {
			reqUrl = "http://"+langcode+".wikipedia.org/w/index.php?title="+searchName;
		}
		
		wikiReq = $.get(reqUrl, function(html) {
			if (articleName = properNameFromHTML(html)) {
				document.getElementById('wdgtSearchInput').value = articleName;
			} else {
				articleName = search;
			}
			html = processRawHTML(html);
			displayContent(html);
			if (! isHistoryRequest) {
				historian.add(new HistoryObject(articleName, langcode));
				if (window.widget) {
					catCmd = widget.system("/bin/cat > "+historian.currentItem().file, function(object){});
					catCmd.write(encodeURI(html));
					catCmd.close();
				}
			}
		});
		
	//TODO: make sure langcode always has a legitimate value

	}
	
	//TODO: put this stuff somewhere
	// if (properName) {
	//  	resetHistoryObject(properName, langcode);
	//  	document.getElementById('randomLink').src = "Images/randomOff.png";
	// 	historyArray[historyPointer].properURL = "http://"+historyArray[historyPointer].lang+".wikipedia.org/wiki/"+properName.replace(/\s/g, '_');
	// }
	
	
	// if none, pull from wiki
	// get proper name
	// process raw html
	// display
	// if (! isHistoryRequest) add item to history
	
	
	
	//TODO: upon history object creation, check if cache file name exists (in dir or in other history objects?), if so, modify file name
}

function filePathForArticleName(name) {
	//TODO: clean me
	
	nameForFile = name.replace(':', '-').replace(/[(]/g, "lp").replace(/[)]/g, "rp").replace(/'/g, 'qt').replace(/&/g, 'amp');
	//alert(this.nameForFile);
	sameNameForFileCount = 0;

	//TODO: this:
	// if (historyArray.length > 0) {
	// 	for (i=1; i<historyArray.length; i++) {
	// 		if (historyArray[i].nameForFile.toLowerCase() == nameForFile.toLowerCase()) {
	// 			sameNameForFileCount++;
	// 		}
	// 	}
	// }
	path = "/Users/"+userName+"/Library/Caches/WikipediaWidget/"+langcode+"_"+nameForFile;
	if (sameNameForFileCount > 0)
		path += '_'+sameNameForFileCount;
	path += '.html';
	return path;
}

function cancelArticleRequest() {
	//todo: this causes a history error (TypeError - Undefined value (line: 799)) on next article request
	wikiReq.abort();
	progInd.stop();
	
	//TODO: if this is used... roll back last history action (if there was one)
	
	if (stretcher.isStretched() == false) {
		setSearchValue('');
	} else {
		setSearchValue(historian.currentItem().name);
	}
}

function processCachedHTML(input) {
	input = input.replace(/qzq/g, "'");
	return input;
}
function properNameFromHTML(html) {
	/* get the actual page title */
	/*   stored in a js var, eg:  var wgPageName = "Brad Pitt"; */
	properName = '';	
	properNamePattern = /var wgTitle = \"[^\n]+\n/;
	if(properNameMatch = html.match(properNamePattern)) {
	 	eval(properNameMatch[0]);
		properName = wgTitle;
	} else {
		/* try to grab it from the html */
	 	properName = $("#firstHeading", html).text();  //TODO: could be undefined
		properName = $.trim(properName);
		
		//TODO: does the id name change depending on user-set style preference?
	}
	
	return properName;
	
	
}
function processRawHTML(html) {

	//TODO: handle google search, normal search, and search results
	
	/* restrict ourselves to the contents of the "content" div */
	html = $("#content", html).html();
	
	tocPattern = /a\shref="\#([^"]+)"/g;
	tocReplace = 'a href=\'javascript:scrollToAnchor("$1")\'';
	html = html.replace(tocPattern, tocReplace);

	wikiPattern = /href=\n*"\/wiki\/(\S+)\stitle=[^>]+/g;
	wikiReplace = 'href=\'javascript:searchWiki("$1)\'';
	html = html.replace(wikiPattern, wikiReplace);
	
	loginUrl = 'http://'+langcode+'.wikipedia.org/wiki/Special:Userlogin';		
	
	loginPattern = 'searchWiki("Special:Userlogin")';
//	loginReplace = 'openLinkInBrowser("http://'+langcode+'.wikipedia.org/wiki/Special:Userlogin")';
	loginReplace = 'openLinkInBrowser("'+loginUrl+'")';
	html = html.replace(loginPattern, loginReplace);

	imgPattern = /href=\n*"\/wiki\/(\S+)/g;
	imgReplace = 'href=\'javascript:searchWiki("$1)\'';
	html = html.replace(imgPattern, imgReplace);

	searchResNumPattern = /href="\/w\/index.php\?title=Special:Search&amp;search=([^&]+)([^"]+)"/g
	searchResNumReplace = 'href=\'javascript:searchWiki("$1$2");\'';
	html = html.replace(searchResNumPattern, searchResNumReplace);

	newEditPattern = /href="\/w\/index.php\?title=([^"]+)"/g
	newEditReplace = 'href=\'javascript:searchWiki("$1");\'';
	html = html.replace(newEditPattern, newEditReplace);
	
/*	editPattern = /href=\n*"\/(^>\S+)/g;
	editReplace = 'href=\'javascript:openLinkInBrowser("http://' + langcode + '.wikipedia.org/$1)\'';
	html = html.replace(editPattern, editReplace);
*/	
	extPattern = /href=\n*"([^\s>]+)/g;
	extReplace = 'href=\'javascript:openLinkInBrowser("$1)\'';
	html = html.replace(extPattern, extReplace);
	
	srcUrl = 'http://'+langcode+'.wikipedia.org/';		
	
	srcPattern = /src=\n*"\//g;
	srcReplace = 'src="'+srcUrl;
	html = html.replace(srcPattern, srcReplace);
	//"
	
	//<div id="jump-to-nav">Jump to: <a href="#column-one">navigation</a>, <a href="#searchInput">search</a></div>
	jumpnavPattern = /<div id="jump-to-nav">[^q]+?<\/div>/;
	html = html.replace(jumpnavPattern, '');
	
	submit1Pattern = /<input type=['"]submit["'] name=['"]([^'"]+)["']/g;
	submit1Replace = '<input type=\'submit\' name=\'$1\' onclick=\'processForm("$1")\''
	html = html.replace(submit1Pattern, submit1Replace);
	
	submit2Pattern = /<input(.*?)name=['"]([^'"]+)["'] type=['"]submit["']/g;
	submit2Replace = '<input$1type=\'submit\' name=\'$2\' onclick=\'processForm("$2")\''
	html = html.replace(submit2Pattern, submit2Replace);
	
/*	textareaPattern = /<textarea /g;
	textareaReplace = '<textarea onmousemove="wiggleScrollBar();" ';
	html = html.replace(textareaPattern, textareaReplace)*/
	
//	titlePattern = /title="[^"]+"/g;
  //  html = html.replace(titlePattern, '');
	
	return html;
	
		
}
function scrollToAnchor(anchorName) {
	var a = document.getElementById(anchorName);
	if (!a)
		a = document.anchors[anchorName];
	var anchorPosition = a.offsetTop + currentContentTop;
	scrollBy(-anchorPosition);
}

function collapseWidget() {
	if (stretcher.isStretched() == true) {
		document.getElementById('ResizeBox').style.display = "none";
		stretcher.stretch(event);
	}
	document.getElementById('editButton').style.display = "none";
	document.getElementById('editButton').innerHTML = '';
	document.getElementById('fontSizeSmaller').innerHTML = '';
	document.getElementById('fontSizeBigger').innerHTML = '';
}

function getContentTop() {
	var currentContentStyle = document.defaultView.getComputedStyle(contentDiv,"");
	var top = parseInt(currentContentStyle.getPropertyValue("top"));
	if (isNaN(top)) {
		top = 0;
	}
	return top;
	
}

function displayContent(input) {

	if (stretcher.isStretched() == false && input.length > 0) {
		document.getElementById('ResizeBox').style.display = "block";
		document.getElementById('editButton').style.display = 'block';
		document.getElementById('editButton').innerHTML = '✍';
		document.getElementById('fontSizeSmaller').innerHTML = 'A';
		document.getElementById('fontSizeBigger').innerHTML = 'A';
		document.getElementById('editButton').onclick = function() { searchWiki(historian.currentItem().name + '&action=edit') }
		stretcher.stretch(event);
	}
	
	progInd.stop();
	contentDiv.innerHTML = input;
	calculateAndShowThumb(contentDiv);
	//TODO: this
	// calculateAndShowThumb(contentDiv);
	scrollBy(55000);
	// if (historyArray[historyPointer]) {
	// 	scrollBy(historyArray[historyPointer].contentTop);
	// }
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
	calculateAndShowThumb(contentDiv);
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
		//TODO: new history; check if this still works
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
	// if (historyArray.length > 0) {
	// 	for (i=1; i<historyArray.length; i++) {
	// 		if (historyArray[i].nameForFile.toLowerCase() == this.nameForFile.toLowerCase()) {
	// 			sameNameForFileCount++;
	// 		}
	// 	}
	// }
	if (sameNameForFileCount == 0) {
		this.file = "/Users/"+userName+"/Library/Caches/WikipediaWidget/"+lang+"_"+this.nameForFile+".html";
	} else {
		this.file = "/Users/"+userName+"/Library/Caches/WikipediaWidget/"+lang+"_"+this.nameForFile+"."+sameNameForFileCount+".html";
	}
	this.properURL = "http://"+this.lang+".wikipedia.org/wiki/";	
	this.contentTop = 0;
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
	calculateAndShowThumb(contentDiv);
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