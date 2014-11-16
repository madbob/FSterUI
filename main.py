#!/usr/bin/python

import threading
import time
import os
import subprocess

import dbus
import json
import cherrypy
import xml.dom.minidom

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

		query = "SELECT ?a ?l ?c ?r WHERE {?a a rdf:Property . ?a rdfs:label ?l . ?a rdfs:comment ?c . ?a rdfs:range ?r}"
		self.propertiesResponse = self.dbusclient.SparqlQuery(query)

	def properties(self, term):
		response = [ f for f in self.propertiesResponse if term.lower() in f[1].lower() ]
		return json.dumps(response)

	properties.exposed = True

	def browse(self):
		path = os.path.expanduser("~/.fster/confs/")
		confs = [ f for f in os.listdir(path) if os.path.isfile(os.path.join(path,f)) ]
		return json.dumps(confs)

	browse.exposed = True

	def remove(self, confname):
		path = os.path.expanduser("~/.fster/confs/" + confname)
		os.remove(path)
		return confname

	remove.exposed = True

	def save(self, contents, name):
		path = os.path.expanduser("~/.fster/confs/" + name)

		try:
			x = xml.dom.minidom.parseString(contents)
			out_file = open(path,"w")
			out_file.write(x.toprettyxml())
			out_file.close()
			return path
		except IOError:
			return "0"

	save.exposed = True

	def open(self, confname):
		confpath = os.path.expanduser("~/.fster/confs/" + confname)

		mountpath = os.path.expanduser("~/.fster/mountpoints/" + confname)
		if not os.path.isdir(mountpath):
			os.makedirs(mountpath)
		if not os.path.ismount (mountpath):
			subprocess.call(('fster', '-c', confpath, mountpath))

		subprocess.call(('xdg-open', mountpath))

	open.exposed = True

class TndServerThread (threading.Thread):
	def run(self):
		current_dir = os.path.dirname(os.path.abspath(__file__))

		conf = {'/js': {'tools.staticdir.on': True,
		                'tools.staticdir.dir': os.path.join(current_dir, 'js')}}

		conf = {'/css': {'tools.staticdir.on': True,
		                'tools.staticdir.dir': os.path.join(current_dir, 'css')}}

		conf = {'/fonts': {'tools.staticdir.on': True,
		                'tools.staticdir.dir': os.path.join(current_dir, 'fonts')}}

		conf = {'/': {'tools.staticdir.on': True,
		              'tools.staticdir.dir': current_dir}}

		self.child = TndServer()
		cherrypy.quickstart(self.child, '/', config=conf)

	def stop(self):
		cherrypy.engine.exit()

class Browser:
	default_site = "http://localhost:8080/index.html"

	def delete_event(self, widget, event, data=None):
		return False

	def destroy(self, widget, data=None):
		gtk.main_quit()

	def __init__(self):
		gobject.threads_init()
		self.window = gtk.Window(gtk.WINDOW_TOPLEVEL)
		self.window.set_title("FSterUI")
		self.window.set_resizable(False)
		self.window.set_size_request(800, 600)
		self.window.connect("delete_event", self.delete_event)
		self.window.connect("destroy", self.destroy)

		self.web_view = webkit.WebView()
		self.web_view.open(self.default_site)

		self.window.add(self.web_view)
		self.window.show_all()

	def main(self):
		gtk.main()

if __name__ == '__main__':
	path = os.path.expanduser("~/.fster/confs/")
	if not os.path.isdir(path):
		os.makedirs(path)

	path = os.path.expanduser("~/.fster/mountpoints/")
	if not os.path.isdir(path):
		os.makedirs(path)

	t = TndServerThread ()
	t.start ()

	# This is to permit the CherryPy server to init
	# Probably some better method exists...
	time.sleep(2)

	browser = Browser()
	browser.main()

	t.stop ()
