Wikipedia Dashboard Widget (for Mac OS X)
=========================================

Easy development setup:
    
1. Enable the Dashboard developer mode (so widgets can be displayed on the desktop).  In a terminal window, run:

    defaults write com.apple.dashboard devmode YES && killall Dock

2. git clone git://github.com/sbillig/wikipedia-widget.git

3. Double click the Wikipedia.wdgt bundle.
    
4. A 'Widget Installer' dialog box should pop up.  Hold Command-Option, and the 'Install' button will change to 'Run'.  Click it, and the Dashboard will activate, showing the widget.

5. Begin dragging the widget and, without lifting the mouse button, deactivate the Dashboard by pressing F12 (or whatever button you have assigned).  The widget will escape from the dashboard.

6. Make some changes to the widget source code.
    
7. Click somewhere on the widget to activate it, then press Command-R.  The widget will reload with your changes applied.

8. Repeat steps 6 and 7 until you're satisfied.

9. Send me a pull request on github or email me a patch (sbillig@whatsinthehouse.com).