# Heroku Guide for setting up gdrive mirror bot.

## Clone this bot source

## Follow the README to first run it locally and test.

## Now, install [heroku cli](https://devcenter.heroku.com/articles/heroku-cli).

## Login into your heroku account by:
	heroku login

## Now, make a project on heroku, say xxx.

## Then, do these commands:
	heroku git:remote -a xxx
	heroku stack:set container
	./magic.sh

### Warning: Never push to a public source with this commit included, this file contain your important credentials.

## Now, restart worker dyno by following commands:
	heroku ps:scale worker=0
	
	heroku ps:scale worker=1

## Your bot is successfully running on heroku.
