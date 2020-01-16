# PeerTube peertube-plugin-georegister

Peertube plugin for blocking registration depending on ip's country.

**IMPORTANT NOTE** : this plugin is not compatible with Peertube v2.0.0. You have to wait for v2.1.0. 

The country of the user is determined based on a whois query. In a later version, we will propose the choice to user geoip (with maxmind database) instead.

You can specify a country white list, and a country black list.

