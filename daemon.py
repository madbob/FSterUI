#!/usr/bin/python

import threading
import time
import os.path

import dbus
import json
import cherrypy

import pygtk
pygtk.require('2.0')
import gtk
import webkit
import gobject

class TndServer (object):
	def __init__(self):
		bus = dbus.SessionBus()
		tracker = bus.get_object('org.freedesktop.Tracker1', '/org/freedesktop/Tracker1/Resources')
		self.dbusclient = dbus.Interface(tracker, dbus_interface='org.freedesktop.Tracker1.Resources')
		return

	def search(self):
		query = "SELECT ?a WHERE {?a a rdf:Property}"
		response = self.dbusclient.SparqlQuery(query)
		return json.dumps(response)
	search.exposed = True

class TndServerThread (threading.Thread):
	def run(self):
		current_dir = os.path.dirname(os.path.abspath(__file__))

		conf = {'/js': {'tools.staticdir.on': True,
		                'tools.staticdir.dir': os.path.join(current_dir, 'js')}}

		conf = {'/css': {'tools.staticdir.on': True,
		                'tools.staticdir.dir': os.path.join(current_dir, 'css')}}

		conf = {'/': {'tools.staticdir.on': True,
		              'tools.staticdir.dir': current_dir}}

		cherrypy.quickstart(TndServer(), '/', config=conf)

class Browser:
	default_site = "http://localhost:8080/index.html"

	def delete_event(self, widget, event, data=None):
		return False

	def destroy(self, widget, data=None):
		gtk.main_quit()

	def __init__(self):
		gobject.threads_init()
		self.window = gtk.Window(gtk.WINDOW_TOPLEVEL)
		self.window.set_resizable(False)
		self.window.set_size_request(600, 500)
		self.window.connect("delete_event", self.delete_event)
		self.window.connect("destroy", self.destroy)

		self.web_view = webkit.WebView()
		self.web_view.open(self.default_site)

		self.window.add(self.web_view)
		self.window.show_all()

	def main(self):
		gtk.main()

if __name__ == '__main__':
	t = TndServerThread ()
	t.start ()

	# This is to permit the CherryPy server to init
	# Probably some better method exists...
	time.sleep(3)

	browser = Browser()
	browser.main()

